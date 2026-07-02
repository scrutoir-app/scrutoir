/*
 * Service worker Scrutoir — PWA statique (Cloudflare Pages).
 *
 * Objectifs : installable + offline, sans build step ni dépendance (pas de Workbox).
 * Stratégies de cache, alignées sur le plan de cache-busting (étape 4 du CLAUDE.md) :
 *   - Coquille (navigation HTML)      : network-first → cache → index.html hors-ligne.
 *   - Bundle JS/CSS /_expo/static/**  : cache-first (noms hashés = immuables).
 *   - Autres assets (icônes, favicon, : stale-while-revalidate.
 *     manifest)
 *   - Données /data/scrutin/**        : cache-first (un scrutin ne change jamais).
 *   - Données /data/** (index, depute,: stale-while-revalidate (fichiers mutables,
 *     parti, categories)                rafraîchis quotidiennement).
 *   - /data/version.json + /index.html: network-first (détection de nouveau déploiement).
 *
 * Versions de cache SÉPARÉES :
 *   - SHELL_VERSION : coquille (index, bundle, polices, icônes) — petite. À bumper à
 *     chaque déploiement pour purger proprement l'ancienne coquille.
 *   - DATA_VERSION  : données JSON (~370 Mo) — à NE bumper QUE si la structure des
 *     fichiers change, sinon on re-télécharge tout inutilement chez l'utilisateur.
 */
const SHELL_VERSION = "v27";
// v4 : les données passent sur le projet Pages dédié (data.scrutoir.fr) — le bump purge
// les entrées de l'ancienne origine (scrutoir.fr/data/*), devenues inaccessibles.
const DATA_VERSION = "v4";
// Origines autorisées pour les données : projet Pages « scrutoir-data » (domaine custom
// + repli *.pages.dev). Les JSON y sont servis avec CORS ouvert (réponses non opaques,
// donc cachables ici avec les mêmes stratégies que la même origine).
const DATA_ORIGINS = ["https://data.scrutoir.fr", "https://scrutoir-data.pages.dev"];
// MODEL : modèle e5-small (~118 Mo) + runtime onnxruntime (/ort) + bundle (/vendor) de la
// recherche sémantique. Gros et IMMUABLES par version → cache-first dédié, JAMAIS
// re-téléchargés en tâche de fond. Bumper si la version du modèle/index change.
const MODEL_VERSION = "v1";
const SHELL_CACHE = `scrutoir-shell-${SHELL_VERSION}`;
const DATA_CACHE = `scrutoir-data-${DATA_VERSION}`;
const MODEL_CACHE = `scrutoir-model-${MODEL_VERSION}`;
const OFFLINE_URL = "/index.html";

// Pré-cache minimal : la coquille de navigation + le manifest + les icônes.
// Le bundle JS hashé n'est pas connu ici ; il est mis en cache au 1er chargement
// (cache-first), rendant l'app pleinement hors-ligne après une visite en ligne.
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  // PAS de skipWaiting() automatique : activer un nouveau SW en pleine session forçait
  // un reload immédiat (un test de proximité en cours était perdu au déploiement de
  // 7 h 10). La nouvelle version ATTEND ; l'app affiche « Mise à jour disponible »
  // (src/swUpdate.ts) et poste SKIP_WAITING quand l'utilisateur accepte.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE && k !== MODEL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Permet à la page de forcer l'activation d'un SW en attente (bandeau "mise à jour").
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isExpoStatic(url) {
  return url.pathname.startsWith("/_expo/static/");
}

// ---- Stratégies ----

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

// Annonce la progression du téléchargement du modèle aux pages ouvertes — l'UI de la
// recherche affiche « Téléchargement du modèle… X / Y Mo » au lieu d'une attente muette.
async function annoncerProgresModele(loaded, total) {
  const pages = await self.clients.matchAll({ includeUncontrolled: true });
  for (const p of pages) p.postMessage({ type: "scrutoir:model-progress", loaded, total });
}

// Réassemble le modèle ONNX (~113 Mio) à partir de ses parts < 24 Mio. Cloudflare Pages
// refuse les fichiers > 25 Mio : on ne déploie que les parts (model_quantized.onnx.partNNN)
// + un manifeste, et le SW reconstruit le fichier entier ici, à la volée, puis le met en
// cache. Transparent pour transformers.js, qui croit charger un seul fichier.
async function assembleModel(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const base = request.url; // …/model_quantized.onnx
  const manifest = await fetch(base + ".parts.json").then((r) => r.json());
  const partUrl = (i) => base + ".part" + String(i).padStart(3, "0");
  const purgerParts = () =>
    Promise.all(Array.from({ length: manifest.parts }, (_, i) => cache.delete(partUrl(i))));

  // 1) Télécharge les parts manquantes et les met en cache INDIVIDUELLEMENT, au fil de
  //    l'eau : un échec (réseau coupé, onglet fermé) ne perd pas les parts déjà acquises,
  //    le prochain essai reprend où il en était au lieu de re-télécharger ~113 Mio.
  for (let i = 0; i < manifest.parts; i++) {
    const url = partUrl(i);
    if (!(await cache.match(url))) {
      const res = await fetch(url);
      if (!res.ok) throw new Error("part manquante: " + url);
      await cache.put(url, res);
    }
    annoncerProgresModele(Math.min((i + 1) * manifest.chunk, manifest.bytes), manifest.bytes);
  }

  // 2) Réassemble en relisant les parts depuis le cache UNE PAR UNE (pic mémoire ≈ modèle
  //    + une part, au lieu de 2× le modèle), en VÉRIFIANT la taille annoncée par le
  //    manifeste : sans ce contrôle, des parts issues de deux déploiements croisés
  //    donneraient un modèle corrompu figé en cache-first pour toujours.
  try {
    const out = new Uint8Array(manifest.bytes);
    let off = 0;
    for (let i = 0; i < manifest.parts; i++) {
      const res = await cache.match(partUrl(i));
      if (!res) throw new Error("part évincée du cache: " + partUrl(i));
      const b = new Uint8Array(await res.arrayBuffer());
      if (off + b.length > manifest.bytes) throw new Error("modèle plus grand que le manifeste");
      out.set(b, off);
      off += b.length;
    }
    if (off !== manifest.bytes) throw new Error(`modèle incomplet (${off} ≠ ${manifest.bytes} octets)`);
    const response = new Response(out, {
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(manifest.bytes) },
    });
    await cache.put(request, response.clone());
    await purgerParts(); // le fichier assemblé suffit — libère ~113 Mio de stockage
    return response;
  } catch (err) {
    await purgerParts(); // parts incohérentes → on repart de zéro au prochain essai
    throw err;
  }
}

// network-first avec TIMEOUT : en « lie-fi » (réseau qui rame sans tomber), on sert le
// cache après ~3,5 s au lieu d'attendre l'échec réseau du navigateur (parfois > 30 s
// pour ouvrir la PWA). La requête réseau CONTINUE en arrière-plan et met le cache à
// jour pour la prochaine navigation.
async function networkFirst(request, cacheName, fallbackUrl, timeoutMs = 3500) {
  const cache = await caches.open(cacheName);
  const reseau = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  const cached = await cache.match(request);
  if (cached) {
    const gagnant = await Promise.race([
      reseau.catch(() => null),
      new Promise((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    return gagnant || cached;
  }
  try {
    return await reseau;
  } catch (err) {
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

/**
 * version.json (network-first) + DÉTECTION DE DÉPLOIEMENT : quand `generatedAt` change,
 * les entrées MUTABLES du cache données (index, depute/, parti/, groupe/…) sont purgées
 * — sinon le stale-while-revalidate peut servir le feed d'HIER sous un bandeau « mis à
 * jour aujourd'hui ». Les /data/scrutin/* (immuables) sont conservés. Les pages ouvertes
 * sont prévenues (scrutoir:data-updated) pour vider leur cache mémoire (api.ts) : les
 * écrans suivants repartent sur du frais, SANS reload forcé.
 */
async function versionStrategy(request, url) {
  const cache = await caches.open(DATA_CACHE);
  const ancienne = await cache.match(request);
  const response = await networkFirst(request, DATA_CACHE);
  if (ancienne) purgerSiNouvelleVersion(ancienne, response.clone(), url.origin);
  return response;
}

async function purgerSiNouvelleVersion(ancienneRes, nouvelleRes, origine) {
  try {
    const [a, n] = await Promise.all([ancienneRes.json(), nouvelleRes.json()]);
    if (!a?.generatedAt || !n?.generatedAt || a.generatedAt === n.generatedAt) return;
    const cache = await caches.open(DATA_CACHE);
    const cles = await cache.keys();
    await Promise.all(
      cles
        .filter((req) => {
          const u = new URL(req.url);
          return (
            u.origin === origine &&
            u.pathname.startsWith("/data/") &&
            !u.pathname.startsWith("/data/scrutin/") &&
            u.pathname !== "/data/version.json"
          );
        })
        .map((req) => cache.delete(req))
    );
    const pages = await self.clients.matchAll({ includeUncontrolled: true });
    for (const p of pages) p.postMessage({ type: "scrutoir:data-updated" });
  } catch {
    /* best-effort : une purge ratée = comportement d'avant (SWR) */
  }
}

// Stratégies des données /data/** — identiques quelle que soit l'origine (même origine
// en dev local, projet Pages dédié en prod).
function dataStrategy(request, url) {
  if (url.pathname === "/data/version.json") return versionStrategy(request, url);
  if (url.pathname.startsWith("/data/scrutin/")) return cacheFirst(request, DATA_CACHE);
  return staleWhileRevalidate(request, DATA_CACHE);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Données servies depuis le projet Pages dédié (autre origine, CORS ouvert).
  if (DATA_ORIGINS.includes(url.origin) && url.pathname.startsWith("/data/")) {
    event.respondWith(dataStrategy(request, url));
    return;
  }
  // Au-delà des données ci-dessus, on ne gère que la même origine (coquille, modèle).
  if (url.origin !== self.location.origin) return;

  // 1) Navigation (coquille HTML) → network-first, repli index.html hors-ligne.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, OFFLINE_URL));
    return;
  }

  // 2) Bundle hashé → cache-first (immuable).
  if (isExpoStatic(url)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // 3) Recherche sémantique : modèle e5 (/models), runtime (/ort), bundle (/vendor).
  //    Le modèle entier dépasse 25 Mio (limite Pages) → réassemblé depuis ses parts.
  //    Le reste : cache-first dédié (gros + immuables, pas de re-fetch en tâche de fond).
  if (url.pathname.endsWith("/model_quantized.onnx")) {
    event.respondWith(assembleModel(request, MODEL_CACHE));
    return;
  }
  if (
    url.pathname.startsWith("/models/") ||
    url.pathname.startsWith("/ort/") ||
    url.pathname.startsWith("/vendor/")
  ) {
    event.respondWith(cacheFirst(request, MODEL_CACHE));
    return;
  }

  // 4) Données en même origine (dev local Expo ; plus le cas en prod, cf. DATA_ORIGINS).
  if (url.pathname.startsWith("/data/")) {
    event.respondWith(dataStrategy(request, url));
    return;
  }

  // 5) Autres assets même origine (icônes, favicon, manifest) → SWR.
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
