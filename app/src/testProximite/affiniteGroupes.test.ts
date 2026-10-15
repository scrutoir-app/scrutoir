import { test } from "node:test";
import assert from "node:assert/strict";
import { affiniteGroupes } from "./affiniteGroupes";
import { lignesSpectre } from "./spectre";
import { calculerProximite, type QuestionProximite, type Reponse } from "./score";

// 6 scrutins tranchés. A : 6 votes comparés, d'accord sur 6. D : 6, d'accord sur 3. B : 4 (sous le
// seuil de 5). C : aucun (position « partagé » partout). NI : pas de position de groupe.
const qs: QuestionProximite[] = [1, 2, 3, 4, 5, 6].map((id) => ({
  id,
  theme: id <= 3 ? "eco" : "sante",
  positions: { A: id % 2 ? "pour" : "contre", D: "pour", B: id <= 4 ? "pour" : "abstention", C: "partagé" },
}));
const rep: Record<number, Reponse> = { 1: "pour", 2: "contre", 3: "pour", 4: "contre", 5: "pour", 6: "contre" };
const groupes = ["A", "B", "C", "D"].map((abrev) => ({ abrev }));
const res = calculerProximite(qs, rep, {}, groupes);
const partis = [
  { abrev: "C", nb_deputes: 120 },
  { abrev: "B", nb_deputes: 90 },
  { abrev: "NI", nb_deputes: 11 },
  { abrev: "A", nb_deputes: 17 },
  { abrev: "D", nb_deputes: 60 },
];
const ordre = (l: { parti: { abrev: string | null } }[]) => l.map((x) => x.parti.abrev);

test("pas situé : l'ordre par nombre de sièges, sans %", () => {
  const l = affiniteGroupes(partis, null);
  assert.deepEqual(ordre(l), ["C", "B", "D", "A", "NI"]);
  assert.ok(l.every((x) => x.pct === null && x.votes === 0));
});

test("situé : par affinité décroissante, puis sous le seuil, puis sans vote comparé", () => {
  const l = affiniteGroupes(partis, res);
  assert.deepEqual(ordre(l), ["A", "D", "B", "C", "NI"]);
  assert.deepEqual(l.map((x) => x.votes), [6, 6, 4, 0, 0]);
  assert.equal(l[0].pct, 1);
  assert.equal(l[1].pct, 0.5);
  assert.equal(l[2].pct, null); // B : 4 votes comparés, sous le seuil de 5 → pas de %
  assert.equal(l[3].pct, null);
});

test("les mêmes chiffres que le spectre du résultat du test", () => {
  const { fiables, faibles } = lignesSpectre(res, partis.map((p) => p.abrev));
  const l = affiniteGroupes(partis, res);
  for (const s of [...fiables, ...faibles]) {
    const x = l.find((y) => y.parti.abrev === s.abrev)!;
    assert.equal(x.pct, s.pct);
    assert.equal(x.votes, s.votes);
  }
});

test("seuil réglable, et chaque groupe une seule fois", () => {
  const l = affiniteGroupes(partis, res, 4);
  // B passe le seuil de 4 : son % est celui du moteur (moyenne par thème), pas un compte brut.
  assert.equal(l.find((x) => x.parti.abrev === "B")!.pct, res.global.find((g) => g.abrev === "B")!.pct);
  assert.equal(new Set(ordre(l)).size, partis.length);
});
