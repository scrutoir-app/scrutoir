import { test } from "node:test";
import assert from "node:assert/strict";
import { lignesSpectre, votesCompares, surNVotes, phraseBase, phraseMarge } from "./spectre";
import { calculerProximite, type QuestionProximite, type Reponse } from "./score";
import { SEUIL_FIABILITE } from "../config";

// 6 scrutins tranchés : A a voté sur les 6, B sur 4 (abstention ailleurs), C sur aucun.
const qs: QuestionProximite[] = [1, 2, 3, 4, 5, 6].map((id) => ({
  id,
  theme: id <= 3 ? "eco" : "sante",
  positions: { A: id % 2 ? "pour" : "contre", B: id <= 4 ? "pour" : "abstention", C: "partagé" },
}));
const rep: Record<number, Reponse> = { 1: "pour", 2: "contre", 3: "pour", 4: "pour", 5: "pour", 6: "contre" };
const res = calculerProximite(qs, rep, {}, [{ abrev: "A" }, { abrev: "B" }, { abrev: "C" }]);

test("votes comparés : seuls les scrutins tranchés des deux côtés", () => {
  assert.equal(votesCompares(res, "A"), 6);
  assert.equal(votesCompares(res, "B"), 4);
  assert.equal(votesCompares(res, "C"), 0);
});

test("sous le seuil (5, celui des fiches) : pas de %, rangé en bas", () => {
  assert.equal(SEUIL_FIABILITE, 5);
  const { fiables, faibles } = lignesSpectre(res, ["A", "B", "C"]);
  assert.deepEqual(fiables.map((l) => [l.abrev, l.votes]), [["A", 6]]);
  assert.ok(fiables[0].pct != null);
  // C n'a aucun vote comparé (position « partagé » partout) : absent du spectre.
  assert.deepEqual(faibles, [{ abrev: "B", pct: null, votes: 4 }]);
});

test("ordre des fiables = ordre du moteur, et seuil réglable", () => {
  const { fiables, faibles } = lignesSpectre(res, ["B", "A", "C"], 4);
  assert.deepEqual(fiables.map((l) => l.abrev), res.global.map((g) => g.abrev));
  assert.deepEqual(faibles, []);
});

test("un groupe non demandé n'apparaît pas", () => {
  const { fiables, faibles } = lignesSpectre(res, ["B"]);
  assert.deepEqual(fiables, []);
  assert.deepEqual(faibles.map((l) => l.abrev), ["B"]);
});

test("phrases : base, marge et « sur N votes »", () => {
  assert.equal(surNVotes(1), "sur 1 vote");
  assert.equal(surNVotes(7), "sur 7 votes");
  assert.equal(phraseBase(8), "Calculé sur les 8 scrutins où tu as tranché, pour ou contre. Un spectre, pas un verdict.");
  assert.equal(phraseBase(1), "Calculé sur le seul scrutin où tu as tranché, pour ou contre. Un spectre, pas un verdict.");
  assert.match(phraseBase(0), /aucun scrutin/);
  assert.equal(
    phraseMarge(8),
    "Avec 8 votes, quelques points d'écart ne veulent rien dire. Sous 5 votes comparés, on n'affiche pas de pourcentage."
  );
  assert.match(phraseMarge(1), /^Avec 1 vote,/);
});
