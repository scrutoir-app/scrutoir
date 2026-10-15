import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { lireDonneesLocales, lireEtatModele, effacerReponsesTest, effacerScrutinsGardes, supprimerModele, toutEffacer } from "./donneesLocales";
import { sauverTest } from "./testProximite/storage";
import { getFollows, isFollowed, toggleFollow } from "./follows";
import { getKept, toggleKept } from "./keptScrutins";
import { passer, getPassed } from "./passedDeputes";
import { autoriserSemantique } from "./search/consent";

// localStorage + Cache API en mémoire (Node n'en a pas) : posés AVANT tout appel, les
// modules les lisent à l'exécution (`typeof localStorage`), jamais à l'import.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  },
});
const cachesMem = new Map<string, string[]>();
Object.defineProperty(globalThis, "caches", {
  configurable: true,
  value: {
    keys: async () => [...cachesMem.keys()],
    delete: async (nom: string) => cachesMem.delete(nom),
    open: async (nom: string) => ({ keys: async () => (cachesMem.get(nom) ?? []).map((url) => ({ url })) }),
  },
});

// Espion sur toute sortie réseau (fetch + sendBeacon, les deux canaux de track()).
const envois: string[] = [];
globalThis.fetch = (async (url: unknown) => {
  envois.push(String(url));
  return new Response(null);
}) as typeof fetch;
Object.defineProperty(globalThis.navigator ?? globalThis, "sendBeacon", {
  configurable: true,
  value: (url: string) => { envois.push(url); return true; },
});

const ONNX = "https://scrutoir.fr/models/Xenova/multilingual-e5-small/onnx/model_quantized.onnx";

/** Un appareil « plein » : test, suivis, scrutins gardés, deck, modèle, réglages d'affichage. */
async function remplir() {
  sauverTest({ reponses: { 1: "pour", 2: "contre", 3: "sans_avis" }, poids: { ecologie: 2 } });
  for (const u of ["PA1", "PO2"]) if (!isFollowed(u)) toggleFollow(u);
  store.set("scrutoir.suivis.lastSeen", "2026-10-01");
  if (!getKept().includes("VTANR5L17V1")) toggleKept("VTANR5L17V1");
  passer("PA9");
  store.set("scrutoir.affinite.lot", JSON.stringify({ jour: "2026-10-15", uids: ["PA9"] }));
  await autoriserSemantique();
  cachesMem.set("scrutoir-model-v1", [ONNX]);
  cachesMem.set("transformers-cache", [ONNX]);
  cachesMem.set("scrutoir-shell-v9", ["https://scrutoir.fr/index.html"]);
  store.set("scrutoir.scheme", "dark");
  store.set("scrutoir.partyLogos", "1");
  envois.length = 0; // le remplissage passe par les gestes normaux (toggleFollow mesure) : on repart de zéro
}

beforeEach(() => { envois.length = 0; });

test("état lu : compteurs exacts, modèle en cache", async () => {
  await remplir();
  const d = lireDonneesLocales();
  assert.equal(d.test, true);
  assert.equal(d.reponses, 3);
  assert.equal(d.suivis, 2);
  assert.equal(d.gardes, 1);
  assert.equal(await lireEtatModele(), "cache");
});

test("effacer les réponses : test + dérivés du deck effacés, le reste intact, rien d'envoyé", async () => {
  await remplir();
  effacerReponsesTest();
  assert.equal(store.has("scrutoir.test-proximite"), false);
  assert.equal(store.has("scrutoir.affinite.lot"), false);
  assert.deepEqual(getPassed(), []);
  assert.equal(lireDonneesLocales().test, false);
  assert.equal(getKept().length, 1);
  assert.equal(getFollows().length, 2);
  assert.equal(envois.length, 0);
});

test("effacer les scrutins gardés : liste vide, rien d'envoyé", async () => {
  await remplir();
  effacerScrutinsGardes();
  assert.deepEqual(getKept(), []);
  assert.equal(envois.length, 0);
});

test("supprimer le modèle : opt-in retiré, caches du modèle purgés, coquille gardée", async () => {
  await remplir();
  await supprimerModele();
  assert.equal(store.has("scrutoir.semantique.optin"), false);
  assert.deepEqual([...cachesMem.keys()], ["scrutoir-shell-v9"]);
  assert.equal(await lireEtatModele(), null);
  assert.equal(envois.length, 0);
});

test("tout effacer : plus aucune donnée personnelle, affichage conservé, rien d'envoyé", async () => {
  await remplir();
  await toutEffacer();
  const d = lireDonneesLocales();
  assert.deepEqual(d, { test: false, reponses: 0, suivis: 0, gardes: 0 });
  assert.deepEqual(getFollows(), []);
  assert.equal(store.get("hemicycle.follows"), "[]");
  assert.equal(store.has("scrutoir.suivis.lastSeen"), false);
  assert.equal(await lireEtatModele(), null);
  assert.equal(store.get("scrutoir.scheme"), "dark");
  assert.equal(store.get("scrutoir.partyLogos"), "1");
  assert.equal(envois.length, 0);
});

// Témoin : un geste mesuré (toggleFollow) est bien capté par l'espion — les 0 ci-dessus
// ne sont donc pas vacants.
test("témoin de l'espion : un suivi au geste part bien vers l'analytics", () => {
  toggleFollow("PO3");
  assert.equal(envois.length, 1);
});
