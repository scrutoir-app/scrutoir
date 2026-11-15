import test from "node:test";
import assert from "node:assert/strict";
import { calculerProximite, scoreVotant, scrutinUidDeId, type QuestionProximite, type Reponse } from "./score";
import { questionsJouees, nbVotesActuels, nbNeuves, neuvesParTheme, questionsNeuves } from "./config";
import { progressionTest } from "./accordsTexte";

// Le test passe d'une liste de questions à une autre : les réponses restent dans le stockage
// local, rangées par id. Une réponse à un id qui n'est plus dans /data/test-proximite.json ne
// doit entrer ni dans le résultat, ni dans les compteurs, ni dans « Affiner ».

const GROUPES = ["A", "B"].map((abrev) => ({ abrev }));

// Le test actuel : trois questions, deux thèmes.
const ACTUELLES: QuestionProximite[] = [
  { id: 1, theme: "eco", positions: { A: "pour", B: "contre" } },
  { id: 2, theme: "eco", positions: { A: "contre", B: "contre" } },
  { id: 3, theme: "sante", positions: { A: "pour", B: "pour" } },
];

// Réponses stockées : une seule question actuelle tranchée (1), et trois questions retirées
// (90, 91, 92), dont une sur un thème que le test garde.
const REPONSES: Record<number, Reponse> = { 1: "pour", 90: "contre", 91: "pour", 92: "sans_avis" };
const SANS_RETIREES: Record<number, Reponse> = { 1: "pour" };

test("résultat : les questions retirées sont ignorées", () => {
  const jouees = questionsJouees(ACTUELLES, REPONSES);
  assert.deepEqual(jouees.map((q) => q.id), [1]);
  assert.deepEqual(
    calculerProximite(jouees, REPONSES, {}, GROUPES),
    calculerProximite(questionsJouees(ACTUELLES, SANS_RETIREES), SANS_RETIREES, {}, GROUPES),
  );
});

test("proximité avec un député : les questions retirées sont ignorées", () => {
  const votes = { [scrutinUidDeId(1)]: "pour", [scrutinUidDeId(90)]: "contre", [scrutinUidDeId(91)]: "pour" };
  const jouees = questionsJouees(ACTUELLES, REPONSES);
  assert.deepEqual(scoreVotant(jouees, REPONSES, {}, votes), { pct: 1, comparable: 1 });
});

test("compteurs : base « Sur tes N votes » et progression sur les seules questions actuelles", () => {
  assert.equal(nbVotesActuels(ACTUELLES, REPONSES), 1);
  assert.deepEqual(progressionTest(ACTUELLES, REPONSES), { faits: 1, total: 3, restants: 2 });
  assert.equal(nbNeuves(ACTUELLES, REPONSES), 2);
  assert.deepEqual(neuvesParTheme(ACTUELLES, REPONSES), { eco: 1, sante: 1 });
});

test("« Affiner » : ni proposée ni comptée comme couverture, une question retirée", () => {
  const avec = questionsNeuves(ACTUELLES, REPONSES).map((q) => q.id);
  const sans = questionsNeuves(ACTUELLES, SANS_RETIREES).map((q) => q.id);
  assert.deepEqual(avec, [3, 2]); // « sante » d'abord : thème sans réponse actuelle
  assert.deepEqual(avec, sans);
  assert.ok(!avec.some((id) => id >= 90));
});

test("seulement des réponses retirées : aucune question jouée, aucun vote compté", () => {
  const orphelines: Record<number, Reponse> = { 90: "contre", 91: "pour" };
  assert.deepEqual(questionsJouees(ACTUELLES, orphelines), []);
  assert.equal(nbVotesActuels(ACTUELLES, orphelines), 0);
  assert.equal(progressionTest(ACTUELLES, orphelines).faits, 0);
  assert.equal(nbNeuves(ACTUELLES, orphelines), 3);
});
