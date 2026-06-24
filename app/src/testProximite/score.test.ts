import test from "node:test";
import assert from "node:assert/strict";
import { calculerProximite, type QuestionProximite, type GroupeProximite } from "./score";

// Les 11 groupes + NI (comme /data/partis.json).
const GROUPES: GroupeProximite[] = [
  "LFI-NFP", "GDR", "ECOS", "SOC", "LIOT", "DEM", "EPR", "HOR", "DR", "UDDPLR", "RN", "NI",
].map((abrev) => ({ abrev }));

// Impôt plancher (id 881, economie) : gauche pour, centre+droite contre, RN abstention,
// LIOT absent. Signature réelle PPPP-CCCCCA.
const IMPOT_PLANCHER: QuestionProximite = {
  id: 881,
  theme: "economie",
  positions: {
    "LFI-NFP": "pour", GDR: "pour", ECOS: "pour", SOC: "pour",
    DEM: "contre", EPR: "contre", HOR: "contre", DR: "contre", UDDPLR: "contre",
    RN: "abstention", // LIOT absent
  },
};

test("répondre « pour » à l'impôt plancher : accord à gauche, désaccord centre-droite", () => {
  const r = calculerProximite([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, GROUPES);
  const eco = r.parTheme.economie;

  for (const g of ["LFI-NFP", "GDR", "ECOS", "SOC"]) {
    assert.equal(eco[g].pct, 1, `${g} doit être en accord (100 %)`);
    assert.equal(eco[g].comparable, 1);
  }
  for (const g of ["DEM", "EPR", "HOR", "DR", "UDDPLR"]) {
    assert.equal(eco[g].pct, 0, `${g} doit être en désaccord (0 %)`);
    assert.equal(eco[g].comparable, 1);
  }
});

test("RN (abstention) et LIOT (absent) restent non comparables", () => {
  const r = calculerProximite([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, GROUPES);
  const eco = r.parTheme.economie;
  for (const g of ["RN", "LIOT", "NI"]) {
    assert.equal(eco[g].pct, null, `${g} non comparable`);
    assert.equal(eco[g].comparable, 0);
  }
  // Absents du classement global (aucun comparable).
  for (const g of ["RN", "LIOT", "NI"]) {
    assert.equal(r.global.find((x) => x.abrev === g), undefined);
  }
});

test("global trié décroissant : gauche en tête (100 %), centre-droite en bas (0 %)", () => {
  const r = calculerProximite([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, GROUPES);
  assert.equal(r.global[0].pct, 1);
  assert.equal(r.global[r.global.length - 1].pct, 0);
  for (const g of ["LFI-NFP", "GDR", "ECOS", "SOC"]) {
    assert.equal(r.global.find((x) => x.abrev === g)!.pct, 1);
  }
  for (const g of ["DEM", "EPR", "HOR", "DR", "UDDPLR"]) {
    assert.equal(r.global.find((x) => x.abrev === g)!.pct, 0);
  }
});

test("« sans_avis » : la question ne compte pas", () => {
  const r = calculerProximite([IMPOT_PLANCHER], { 881: "sans_avis" }, { economie: 1 }, GROUPES);
  for (const g of GROUPES) assert.equal(r.parTheme.economie[g.abrev].comparable, 0);
  assert.equal(r.global.length, 0);
});

test("réponse absente : ignorée comme sans_avis", () => {
  const r = calculerProximite([IMPOT_PLANCHER], {}, { economie: 1 }, GROUPES);
  assert.equal(r.parTheme.economie["LFI-NFP"].comparable, 0);
  assert.equal(r.global.length, 0);
});

test("global = moyenne pondérée des pct par thème (poids)", () => {
  // economie : LFI accord (pct 1). sante : LFI désaccord (pct 0).
  const Q_SANTE: QuestionProximite = {
    id: 999, theme: "sante",
    positions: { "LFI-NFP": "contre", DEM: "pour" },
  };
  const questions = [IMPOT_PLANCHER, Q_SANTE];
  const reponses = { 881: "pour" as const, 999: "pour" as const };

  // poids égaux → LFI = (1*1 + 0*1)/(1+1) = 0.5
  const egal = calculerProximite(questions, reponses, { economie: 1, sante: 1 }, GROUPES);
  assert.equal(egal.global.find((x) => x.abrev === "LFI-NFP")!.pct, 0.5);

  // economie pesé 3, sante pesé 1 → LFI = (1*3 + 0*1)/4 = 0.75
  const pondere = calculerProximite(questions, reponses, { economie: 3, sante: 1 }, GROUPES);
  assert.equal(pondere.global.find((x) => x.abrev === "LFI-NFP")!.pct, 0.75);
  // DEM : economie désaccord (0), sante accord (1) → (0*3 + 1*1)/4 = 0.25
  assert.equal(pondere.global.find((x) => x.abrev === "DEM")!.pct, 0.25);
});
