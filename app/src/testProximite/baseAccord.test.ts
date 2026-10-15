import { test } from "node:test";
import assert from "node:assert/strict";
import { baseAccordVotant, baseAccordGroupe, resultatVotant, accordsParTheme, pctPondereDiffere, verdictVote, CLE_VOTANT } from "./baseAccord";
import { calculerProximite, type QuestionProximite, type Reponse } from "./score";

const q = (id: number, theme: string, positions: QuestionProximite["positions"] = {}): QuestionProximite => ({ id, theme, positions });
const uid = (id: number) => `VTANR5L17V${id}`;

test("base avec un député : seuls les scrutins tranchés des deux côtés comptent", () => {
  const qs = [q(1, "eco"), q(2, "eco"), q(3, "sante"), q(4, "sante"), q(5, "sante")];
  const rep: Record<number, Reponse> = { 1: "pour", 2: "contre", 3: "pour", 4: "sans_avis", 5: "pour" };
  const votes = { [uid(1)]: "pour", [uid(2)]: "pour", [uid(3)]: "abstention", [uid(4)]: "pour", [uid(5)]: "pour" };
  // 1 comme, 2 inverse, 3 abstention (non comparable), 4 sans avis (non comparable), 5 comme.
  assert.deepEqual(baseAccordVotant(qs, rep, votes), { comparable: 3, accord: 2, inverse: 1 });
  assert.deepEqual(baseAccordVotant(qs, {}, votes), { comparable: 0, accord: 0, inverse: 0 });
});

test("base avec un groupe : relue dans le résultat du moteur", () => {
  const qs = [q(1, "eco", { A: "pour" }), q(2, "eco", { A: "pour" }), q(3, "sante", { A: "contre" }), q(4, "sante", { A: "abstention" })];
  const res = calculerProximite(qs, { 1: "pour", 2: "contre", 3: "contre", 4: "pour" }, {}, [{ abrev: "A" }]);
  assert.deepEqual(baseAccordGroupe(res, "A"), { comparable: 3, accord: 2, inverse: 1 });
  assert.deepEqual(baseAccordGroupe(res, "B"), { comparable: 0, accord: 0, inverse: 0 });
});

test("accord par thème : fiables d'abord (% décroissant), puis sous le seuil (base décroissante)", () => {
  const qs: QuestionProximite[] = [];
  const rep: Record<number, Reponse> = {};
  const votes: Record<string, string> = {};
  let id = 1;
  // eco : 6 comparés, 3 comme toi (50 %) ; secu : 8 comparés, 6 comme toi (75 %) ; sante : 3 ; ecolo : 1.
  const theme = (t: string, n: number, comme: number) => {
    for (let i = 0; i < n; i++, id++) {
      qs.push(q(id, t));
      rep[id] = "pour";
      votes[uid(id)] = i < comme ? "pour" : "contre";
    }
  };
  theme("eco", 6, 3);
  theme("secu", 8, 6);
  theme("sante", 3, 3);
  theme("ecolo", 1, 0);
  const res = resultatVotant(qs, rep, {}, votes);
  const l = accordsParTheme(res, CLE_VOTANT, 5);
  assert.deepEqual(l.map((x) => [x.id, x.comparable, x.fiable]), [
    ["secu", 8, true],
    ["eco", 6, true],
    ["sante", 3, false],
    ["ecolo", 1, false],
  ]);
  assert.equal(l[0].pct, 0.75);
});

test("un thème sans vote comparé n'apparaît pas", () => {
  const res = resultatVotant([q(1, "eco")], { 1: "pour" }, {}, { [uid(1)]: "abstention" });
  assert.deepEqual(accordsParTheme(res, CLE_VOTANT), []);
});

test("le % pondéré du moteur peut différer du simple ratio : on le signale", () => {
  // eco 3/3 (100 %), secu 4/8 (50 %) → moteur 75 % ; ratio brut 7/11 = 64 %.
  assert.equal(pctPondereDiffere(0.75, { comparable: 11, accord: 7, inverse: 4 }), true);
  assert.equal(pctPondereDiffere(7 / 11, { comparable: 11, accord: 7, inverse: 4 }), false);
  assert.equal(pctPondereDiffere(0.5, { comparable: 0, accord: 0, inverse: 0 }), false);
});

test("verdict d'un vote : seulement si toi et l'élu avez tranché", () => {
  assert.equal(verdictVote("pour", "pour"), "comme");
  assert.equal(verdictVote("pour", "contre"), "inverse");
  assert.equal(verdictVote("pour", "abstention"), null);
  assert.equal(verdictVote("sans_avis", "pour"), null);
  assert.equal(verdictVote(undefined, "pour"), null);
});
