import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accordGroupe,
  accordTexte,
  dernierAccord,
  progressionTest,
  positionPourAccord,
  accordsParTexte,
  libelleGroupes,
  majoriteCommeToi,
  phraseAccord,
} from "./accordsTexte";
import type { QuestionProximite, Reponse } from "./score";

// Données fictives : trois scrutins, deux textes, trois groupes.
const Q: QuestionProximite[] = [
  { id: 10, theme: "t", positions: { A: "pour", B: "contre", C: "abstention" } },
  { id: 12, theme: "t", positions: { A: "contre", B: "contre", C: "partagé" } },
  { id: 20, theme: "t", positions: { A: "pour", B: "pour", C: "contre" } },
];
const DOSSIER: Record<number, string> = { 10: "D1", 12: "D1", 20: "D2" };
const dossierDe = (n: number) => DOSSIER[n];
const ABREVS = ["A", "B", "C"];

test("accordGroupe : comme / pas / neutre", () => {
  assert.equal(accordGroupe("pour", "pour"), "comme");
  assert.equal(accordGroupe("contre", "pour"), "pas");
  assert.equal(accordGroupe("abstention", "pour"), "neutre");
  assert.equal(accordGroupe("partagé", "contre"), "neutre");
  assert.equal(accordGroupe(undefined, "contre"), "neutre");
  assert.equal(accordGroupe("pour", "sans_avis"), "neutre");
});

test("accordTexte : retient le scrutin tranché le plus récent du texte", () => {
  const reponses: Record<number, Reponse> = { 10: "pour", 12: "contre", 20: "pour" };
  const a = accordTexte("D1", Q, reponses, dossierDe, ABREVS);
  assert.ok(a);
  assert.equal(a.numero, 12);
  assert.equal(a.reponse, "contre");
  assert.deepEqual(a.parGroupe, { A: "comme", B: "comme", C: "neutre" });
  assert.equal(a.comme, 2);
  assert.equal(a.pas, 0);
  assert.equal(a.total, 3);
});

test("accordTexte : « sans avis » ne situe pas sur un texte", () => {
  const reponses: Record<number, Reponse> = { 10: "pour", 12: "sans_avis" };
  const a = accordTexte("D1", Q, reponses, dossierDe, ABREVS);
  assert.equal(a?.numero, 10);
  assert.equal(accordTexte("D2", Q, { 20: "sans_avis" }, dossierDe, ABREVS), null);
});

test("dernierAccord : saute un texte sans question encore au test", () => {
  const reponses: Record<number, Reponse> = { 20: "contre" };
  const a = dernierAccord(["D9", "D1", "D2"], Q, reponses, dossierDe, ABREVS);
  assert.equal(a?.ref, "D2");
  assert.deepEqual(a?.parGroupe, { A: "pas", B: "pas", C: "comme" });
  assert.equal(dernierAccord(["D9"], Q, reponses, dossierDe, ABREVS), null);
});

test("progressionTest : « sans avis » compte comme une réponse", () => {
  const p = progressionTest(Q, { 10: "pour", 12: "sans_avis", 99: "contre" });
  assert.deepEqual(p, { faits: 2, total: 3, restants: 1 });
});

// Questions AVEC décomptes (fichier v1.24.0) : la position du groupe est recalculée sur ses votants.
const QD: QuestionProximite[] = [
  {
    id: 30,
    theme: "t",
    // Positions du test (règle des 60 %) : volontairement différentes, pour vérifier qu'elles ne servent plus.
    positions: { A: "partagé", B: "pour", C: "pour", D: "pour" },
    decomptes: {
      A: { pour: 10, contre: 8, abstention: 4 }, // le test dit « partagé » ; la majorité dit pour
      B: { pour: 17, contre: 17, abstention: 1 }, // égalité en tête → aucune position (gris)
      C: { pour: 0, contre: 3, abstention: 5 }, // abstention majoritaire → gris
      // D : aucun votant → gris
    },
  },
];

test("positionPourAccord : majorité des votants (decompte.ts), égalité ou absence = aucune position", () => {
  assert.equal(positionPourAccord(QD[0], "A"), "pour");
  assert.equal(positionPourAccord(QD[0], "B"), null);
  assert.equal(positionPourAccord(QD[0], "C"), "abstention");
  assert.equal(positionPourAccord(QD[0], "D"), null);
  // Fichier sans décomptes (cache d'avant v1.24.0) : position du test.
  assert.equal(positionPourAccord(Q[1], "C"), "partagé");
  assert.equal(positionPourAccord(Q[0], "A"), "pour");
});

test("accordTexte : sur les décomptes, l'égalité et l'abstention restent neutres", () => {
  const a = accordTexte("D3", QD, { 30: "pour" }, () => "D3", ["A", "B", "C", "D"]);
  assert.deepEqual(a?.parGroupe, { A: "comme", B: "neutre", C: "neutre", D: "neutre" });
  assert.equal(a?.comme, 1);
  assert.equal(a?.pas, 0);
  const b = accordTexte("D3", QD, { 30: "contre" }, () => "D3", ["A", "B", "C", "D"]);
  assert.equal(b?.comme, 0);
  assert.equal(b?.pas, 1);
});

test("accordsParTexte : un accord par texte situé, dans l'ordre donné, textes sans question sautés", () => {
  const reponses: Record<number, Reponse> = { 10: "pour", 20: "contre" };
  const l = accordsParTexte(["D2", "D9", "D1"], Q, reponses, dossierDe, ABREVS);
  assert.deepEqual(l.map((a) => [a.ref, a.numero, a.comme, a.pas]), [["D2", 20, 1, 2], ["D1", 10, 1, 1]]);
  assert.deepEqual(accordsParTexte([], Q, reponses, dossierDe, ABREVS), []);
});

test("libellés : nombre de groupes, majorité, phrase lue sans nom de groupe", () => {
  assert.equal(libelleGroupes(7, 11), "7 groupes sur 11");
  assert.equal(libelleGroupes(1, 11), "1 groupe sur 11");
  assert.equal(libelleGroupes(0, 11), "Aucun groupe sur 11");
  assert.equal(majoriteCommeToi({ comme: 6, total: 11 }), true);
  assert.equal(majoriteCommeToi({ comme: 5, total: 11 }), false);
  assert.equal(majoriteCommeToi({ comme: 2, total: 4 }), false);
  assert.equal(majoriteCommeToi({ comme: 0, total: 0 }), false);
  assert.equal(phraseAccord({ comme: 7, pas: 2, total: 11 }), "7 groupes sur 11 ont voté comme toi, 2 autrement, 2 ni pour ni contre ou à égalité");
  assert.equal(phraseAccord({ comme: 1, pas: 10, total: 11 }), "1 groupe sur 11 a voté comme toi, 10 autrement");
  assert.equal(phraseAccord({ comme: 0, pas: 0, total: 11 }), "Aucun groupe sur 11 n'a voté comme toi, 11 ni pour ni contre ou à égalité");
});
