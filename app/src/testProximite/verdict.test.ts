import { test } from "node:test";
import assert from "node:assert/strict";
import {
  campGagnant,
  positionMajoritaire,
  tailleGroupe,
  groupesPos,
  verdictVote,
  verdictDeduit,
  verdictScrutin,
  type GroupePos,
} from "./verdict";
import type { ContexteJe } from "./jeProximite";
import type { GroupeVentilation } from "../types";

// ctx minimal : seul `resultat.global` (proximité par groupe) est lu par verdictDeduit.
function ctxAvec(pct: Record<string, number>): ContexteJe {
  return {
    reponses: {},
    poids: {},
    questions: [],
    resultat: {
      parTheme: {},
      global: Object.entries(pct).map(([abrev, p]) => ({ abrev, pct: p, themes: 1 })),
    },
    comparableParGroupe: {},
    nbVotes: 0,
  } as ContexteJe;
}

const g = (abrev: string, pour: number, contre: number, abstention = 0, absent = 0): GroupeVentilation => ({
  uid: abrev, libelle: abrev, abrev, couleur: null, consigne: null, pour, contre, abstention, absent,
});

test("campGagnant : adopté → pour, rejeté → contre, sinon null", () => {
  assert.equal(campGagnant("adopte"), "pour");
  assert.equal(campGagnant("rejete"), "contre");
  assert.equal(campGagnant(null), null);
});

test("positionMajoritaire / tailleGroupe / groupesPos", () => {
  assert.equal(positionMajoritaire(g("A", 10, 3, 2)), "pour");
  assert.equal(positionMajoritaire(g("A", 3, 10, 2)), "contre");
  assert.equal(positionMajoritaire(g("A", 1, 1, 9)), "abstention");
  assert.equal(tailleGroupe(g("A", 10, 3, 2, 5)), 20);
  assert.deepEqual(groupesPos([g("A", 10, 3, 0, 2)]), [{ abrev: "A", taille: 15, position: "pour" }]);
});

test("verdictVote : réponse comparée au résultat (sans_avis → pas de niveau voté)", () => {
  assert.deepEqual(verdictVote("pour", "adopte"), { niveau: "vote", sens: "align" });
  assert.deepEqual(verdictVote("pour", "rejete"), { niveau: "vote", sens: "oppose" });
  assert.deepEqual(verdictVote("contre", "rejete"), { niveau: "vote", sens: "align" });
  assert.equal(verdictVote("sans_avis", "adopte"), null);
  assert.equal(verdictVote(undefined, "adopte"), null);
});

test("verdictDeduit : penche du côté des groupes les plus proches", () => {
  // Proche de A (0.9) qui a voté « pour » ; loin de B (0.1) qui a voté « contre ».
  const groupes: GroupePos[] = [
    { abrev: "A", taille: 100, position: "pour" },
    { abrev: "B", taille: 100, position: "contre" },
  ];
  // Adopté (pour gagne) → l'utilisateur penche pour → dans son sens.
  assert.deepEqual(verdictDeduit(ctxAvec({ A: 0.9, B: 0.1 }), groupes, "adopte"), { niveau: "deduit", sens: "align" });
  // Rejeté (contre gagne) mais l'utilisateur penche pour → à l'opposé.
  assert.deepEqual(verdictDeduit(ctxAvec({ A: 0.9, B: 0.1 }), groupes, "rejete"), { niveau: "deduit", sens: "oppose" });
});

test("verdictDeduit : Partagé si quasi-égalité, ou rien de comparable / pas de ctx", () => {
  const groupes: GroupePos[] = [
    { abrev: "A", taille: 100, position: "pour" },
    { abrev: "B", taille: 100, position: "contre" },
  ];
  assert.equal(verdictDeduit(ctxAvec({ A: 0.5, B: 0.5 }), groupes, "adopte").sens, "partage");
  assert.equal(verdictDeduit(ctxAvec({ C: 0.9 }), groupes, "adopte").sens, "partage"); // aucun comparable
  assert.equal(verdictDeduit(null, groupes, "adopte").sens, "partage");
});

test("verdictScrutin : verrouillé si pas situé ; voté prioritaire sur déduit", () => {
  const groupes: GroupePos[] = [{ abrev: "A", taille: 100, position: "pour" }];
  const ctx = ctxAvec({ A: 0.9 });
  assert.deepEqual(
    verdictScrutin({ ctx, situe: false, reponse: "pour", groupes, sortCode: "adopte" }),
    { niveau: "verrouille", sens: null }
  );
  // Situé + a voté → niveau voté (pas déduit).
  assert.equal(verdictScrutin({ ctx, situe: true, reponse: "contre", groupes, sortCode: "adopte" }).niveau, "vote");
  // Situé + sans_avis → bascule en déduit.
  assert.equal(verdictScrutin({ ctx, situe: true, reponse: "sans_avis", groupes, sortCode: "adopte" }).niveau, "deduit");
});
