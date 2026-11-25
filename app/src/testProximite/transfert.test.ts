import { test } from "node:test";
import assert from "node:assert/strict";
import { chargerTest, decoderPartage, effacerTest, encoderPartage, fusionnerReponses, urlPartage } from "./storage";
import {
  VERSION_TRANSFERT, decoderTransfert, encoderTransfert, importerTransfert, lireTexteTransfert, urlTransfert,
} from "./transfert";
import { getFollows, viderSuivis } from "../follows";

// localStorage en mémoire, posé avant tout appel (les stores le lisent à l'exécution).
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

// Espion sur toute sortie réseau : le transfert ne doit JAMAIS en provoquer (ni mesure, ni requête).
process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";
const sorties: string[] = [];
globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
  sorties.push(`${String(url)} ${String(init?.body ?? "")}`);
  return new Response(null);
}) as typeof fetch;
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, body: string) => { sorties.push(`${url} ${body}`); return true; },
  });
}

const etat = {
  reponses: { 881: "pour", 1204: "contre", 3005: "sans_avis", 7303: "pour" } as const,
  poids: { ecologie: 2, sante: 0.5, economie: 1 },
  origines: { 7303: "scrutin" } as const,
};
const suivis = ["PA841605", "PO800490"];

test("transfert : aller-retour complet (réponses, poids, origines, suivis), version 1", () => {
  const code = encoderTransfert(etat, suivis);
  assert.match(code, /^[A-Za-z0-9_-]+$/, "URL-safe, sans remplissage");
  const d = decoderTransfert(code);
  assert.ok(d);
  assert.deepEqual(d.reponses, etat.reponses);
  assert.deepEqual(d.poids, etat.poids);
  assert.deepEqual(d.origines, etat.origines);
  assert.deepEqual(d.suivis, suivis);
  assert.equal(JSON.parse(Buffer.from(code.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()).v, VERSION_TRANSFERT);
});

test("transfert : reprend le contenu d'un lien de résultat, plus les suivis", () => {
  const partage = decoderPartage(encoderPartage(etat.reponses, etat.poids, etat.origines));
  const d = decoderTransfert(encoderTransfert(etat, []));
  assert.deepEqual({ reponses: d!.reponses, poids: d!.poids, origines: d!.origines }, partage);
  assert.deepEqual(d!.suivis, []);
});

test("transfert : rejet propre d'un texte quelconque, d'une autre version, d'un contenu trafiqué", () => {
  for (const t of ["", "bonjour", "https://exemple.org/", "%%%", "e30", "bnVsbA", "WzEsMiwzXQ"])
    assert.equal(decoderTransfert(t), null, t);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  assert.equal(decoderTransfert(b64({ r: { 1: 1 } })), null, "sans version");
  assert.equal(decoderTransfert(b64({ v: 2, r: { 1: 1 } })), null, "version inconnue");
  assert.equal(decoderTransfert(b64({ v: 1, r: {} })), null, "vide");
  const d = decoderTransfert(b64({ v: 1, r: { 1: 1, x: 2, 3: 9, 4: 0 }, w: { a: 99, b: 2 }, o: [4, 77, "x"], s: ["PA1", "<script>", 5, "PO2", "PA1"] }));
  assert.deepEqual(d!.reponses, { 1: "pour", 4: "sans_avis" });
  assert.deepEqual(d!.poids, { b: 2 });
  assert.deepEqual(d!.origines, { 4: "scrutin" });
  assert.deepEqual(d!.suivis, ["PA1", "PO2"]);
});

test("texte collé : lien de transfert, lien #test=, ou rien de Scrutoir", () => {
  const url = urlTransfert(encoderTransfert(etat, suivis), "https://scrutoir.fr");
  assert.match(url, /^https:\/\/scrutoir\.fr\/\?via=transfert#transfert=[A-Za-z0-9_-]+$/);
  const t = lireTexteTransfert(`  ${url}\n`);
  assert.equal(t?.type, "transfert");
  assert.deepEqual(t?.donnees.suivis, suivis);

  const lienTest = urlPartage(etat.reponses, etat.poids, etat.origines);
  const s = lireTexteTransfert(`Mon spectre : ${lienTest}`);
  assert.equal(s?.type, "test");
  assert.deepEqual(s?.donnees.reponses, etat.reponses);
  assert.deepEqual(s?.donnees.suivis, []);

  for (const r of [null, undefined, "", "Rien à voir", "https://scrutoir.fr/", "https://scrutoir.fr/#transfert=zzz", "x".repeat(60_000)])
    assert.equal(lireTexteTransfert(r), null, String(r).slice(0, 40));
});

test("import : fusion, origines et poids restaurés, suivis ajoutés, AUCUNE sortie réseau", () => {
  effacerTest();
  viderSuivis();
  sorties.length = 0;
  fusionnerReponses({ 881: "contre", 42: "pour" }); // déjà là sur l'appareil
  const n = importerTransfert(decoderTransfert(encoderTransfert(etat, suivis))!);
  assert.equal(n, 4);
  const t = chargerTest()!;
  assert.deepEqual(t.reponses, { 42: "pour", ...etat.reponses });
  assert.deepEqual(t.origines, { 7303: "scrutin" });
  assert.deepEqual(t.poids, etat.poids);
  assert.deepEqual(getFollows(), suivis);
  // Un second import ne duplique pas les suivis.
  importerTransfert(decoderTransfert(encoderTransfert(etat, suivis))!);
  assert.deepEqual(getFollows(), suivis);
  assert.deepEqual(sorties, [], "ni mesure ni requête pendant l'import");
});

test("import d'un lien #test= : réponses seules, poids gardés", () => {
  effacerTest();
  viderSuivis();
  const s = lireTexteTransfert(urlPartage({ 10: "pour" }))!;
  assert.equal(importerTransfert(s.donnees), 1);
  assert.deepEqual(chargerTest()!.reponses, { 10: "pour" });
  assert.deepEqual(getFollows(), []);
});
