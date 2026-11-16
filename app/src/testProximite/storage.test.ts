import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chargerTest, effacerTest, fusionnerReponses, poserReponse, retirerReponse, sauverPoids, origineDe, abonnerTest, versionTest,
  ecrireCachePerso, lireCachePerso,
} from "./storage";

// localStorage en mémoire (Node n'en a pas), posé avant tout appel (storage.ts le lit à
// l'exécution, jamais à l'import).
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

test("origine : une réponse sans origine vient du test (rétrocompatible)", () => {
  effacerTest();
  store.set("scrutoir.test-proximite", JSON.stringify({ reponses: { 881: "pour" }, poids: {}, ts: 1 }));
  assert.equal(origineDe(chargerTest(), 881), "test");
});

test("poserReponse : origine « scrutin », sauf question actuelle du test ; horodatage renouvelé", () => {
  effacerTest();
  fusionnerReponses({ 1: "pour" });
  const ts0 = chargerTest()!.ts!;
  poserReponse(9895, "contre");
  poserReponse(289, "pour", { questionTest: true });
  const e = chargerTest()!;
  assert.deepEqual(e.reponses, { 1: "pour", 9895: "contre", 289: "pour" });
  assert.equal(origineDe(e, 9895), "scrutin");
  assert.equal(origineDe(e, 289), "test");
  assert.equal(origineDe(e, 1), "test");
  assert.ok(e.ts! >= ts0);
});

test("retirerReponse : réponse et origine effacées ; les poids et les autres réponses restent", () => {
  effacerTest();
  fusionnerReponses({ 1: "pour" });
  sauverPoids({ economie: 2 });
  poserReponse(9895, "contre");
  retirerReponse(9895);
  const e = chargerTest()!;
  assert.deepEqual(e.reponses, { 1: "pour" });
  assert.equal(e.origines, undefined);
  assert.deepEqual(e.poids, { economie: 2 });
});

test("les poids ne font pas perdre les origines ; le test reprend l'origine d'un numéro", () => {
  effacerTest();
  poserReponse(500, "pour");
  sauverPoids({ sante: 0.5 });
  assert.equal(origineDe(chargerTest(), 500), "scrutin");
  fusionnerReponses({ 500: "contre" }); // la question entre au test, l'utilisateur y répond
  assert.equal(origineDe(chargerTest(), 500), "test");
});

test("abonnement : chaque écriture prévient les écrans (version incrémentée)", () => {
  let appels = 0;
  const stop = abonnerTest(() => appels++);
  const v0 = versionTest();
  poserReponse(42, "pour");
  retirerReponse(42);
  stop();
  poserReponse(43, "pour");
  assert.equal(appels, 2);
  assert.equal(versionTest(), v0 + 3);
});

test("le cache des questions hors test s'efface avec la réponse, et avec tout le test", () => {
  effacerTest();
  poserReponse(700, "pour");
  ecrireCachePerso(700, { q: { id: 700 } });
  ecrireCachePerso(701, { q: { id: 701 } });
  retirerReponse(700);
  assert.deepEqual(Object.keys(lireCachePerso()), ["701"]);
  effacerTest();
  assert.deepEqual(lireCachePerso(), {});
  assert.equal(store.get("scrutoir.questions-perso"), undefined);
});
