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
const SHELL_VERSION = "v12";
const DATA_VERSION = "v2";
const SHELL_CACHE = `scrutoir-shell-${SHELL_VERSION}`;
const DATA_CACHE = `scrutoir-data-${DATA_VERSION}`;
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
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
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

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // On ne gère que la même origine (les données et la coquille y sont servies).
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

  // 3) Données.
  if (url.pathname.startsWith("/data/")) {
    if (url.pathname === "/data/version.json") {
      event.respondWith(networkFirst(request, DATA_CACHE));
    } else if (url.pathname.startsWith("/data/scrutin/")) {
      event.respondWith(cacheFirst(request, DATA_CACHE));
    } else {
      event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    }
    return;
  }

  // 4) Autres assets même origine (icônes, favicon, manifest) → SWR.
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
