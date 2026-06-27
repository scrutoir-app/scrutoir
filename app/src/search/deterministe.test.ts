import test from "node:test";
import assert from "node:assert/strict";
import { normaliser, aplatir, jetons, distanceEdition } from "./normalize";
import { etendreRequete } from "./aliases";
import { routerIntention } from "./intent";

// — Normalisation —
test("normaliser : casse + accents + bords", () => {
  assert.equal(normaliser("  Écologie  "), "ecologie");
  assert.equal(normaliser("Coût de la VIE"), "cout de la vie");
  assert.equal(normaliser(""), "");
});

test("aplatir : ponctuation → espace, encadré, au mot près", () => {
  assert.equal(aplatir("l'ensemble du projet"), " l ensemble du projet ");
  assert.equal(aplatir("49.3"), " 49 3 ");
});

test("jetons : découpe alphanumérique", () => {
  assert.deepEqual(jetons("PMA & fin-de-vie !"), ["pma", "fin", "de", "vie"]);
});

test("distanceEdition : bornée, transpositions", () => {
  assert.equal(distanceEdition("ecologie", "ecologie"), 0);
  assert.equal(distanceEdition("ecologei", "ecologie"), 1); // transposition
  assert.equal(distanceEdition("immigratoin", "immigration"), 1);
  assert.equal(distanceEdition("chat", "cheval", 2), 3); // > max → max+1
});

// — Expansion d'alias —
test("etendreRequete : PMA → expansion factuelle", () => {
  const r = etendreRequete("PMA");
  assert.equal(r.correspondances.length, 1);
  assert.equal(r.correspondances[0].concept, "PMA");
  assert.match(r.enrichi, /procréation médicalement assistée/);
});

test("etendreRequete : 49.3 reconnu malgré la ponctuation", () => {
  const r = etendreRequete("le 49.3 c'est quoi");
  assert.ok(r.correspondances.some((c) => c.concept === "Article 49.3"), "49.3 doit matcher");
});

test("etendreRequete : LGBT enrichi avec thérapies de conversion", () => {
  const r = etendreRequete("droits LGBT");
  assert.match(r.enrichi, /thérapies de conversion/);
});

test("etendreRequete : au mot près (pas de faux positif intra-mot)", () => {
  const r = etendreRequete("amendement"); // ne doit PAS déclencher « ame » (aide médicale d'État)
  assert.equal(r.correspondances.find((c) => c.concept.includes("Aide médicale")), undefined);
});

test("etendreRequete : requête neutre sans alias reste inchangée", () => {
  const r = etendreRequete("transition énergétique");
  assert.equal(r.enrichi, "transition énergétique");
  assert.equal(r.correspondances.length, 0);
});

// — Routage d'intention —
test("routerIntention : numéro de scrutin", () => {
  assert.deepEqual(routerIntention("scrutin 7380").type, "numero");
  assert.equal(routerIntention("scrutin 7380").numero, 7380);
  assert.equal(routerIntention("7380").numero, 7380);
  assert.equal(routerIntention("vote n° 4438").numero, 4438);
});

test("routerIntention : alias de parti = exact", () => {
  assert.equal(routerIntention("RN").type, "exact");
  assert.equal(routerIntention("les républicains").type, "exact");
});

test("routerIntention : sujet en langage naturel", () => {
  const i = routerIntention("aide à mourir");
  assert.equal(i.type, "sujet");
  assert.match(i.enrichi, /soins palliatifs/);
});

test("routerIntention : suggestion de faute ciblée", () => {
  const i = routerIntention("immigratoin");
  assert.equal(i.suggestion, "immigration");
});

test("routerIntention : pas de fausse suggestion sur un mot correct", () => {
  assert.equal(routerIntention("logement").suggestion, null);
  assert.equal(routerIntention("écologie").suggestion, null);
});
