import { test } from "node:test";
import assert from "node:assert/strict";
import { accordGroupe, accordTexte, dernierAccord, progressionTest } from "./accordsTexte";
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
