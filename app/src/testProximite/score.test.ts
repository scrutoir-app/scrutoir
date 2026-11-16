import test from "node:test";
import assert from "node:assert/strict";
import { calculerProximite, scoreVotant, scrutinUidDeId, type QuestionProximite, type GroupeProximite } from "./score";

// Les 11 groupes + NI (comme /data/partis.json).
const GROUPES: GroupeProximite[] = [
  "LFI-NFP", "GDR", "ECOS", "SOC", "LIOT", "DEM", "EPR", "HOR", "DR", "UDR", "RN", "NI",
].map((abrev) => ({ abrev }));

// Impôt plancher (id 881, economie) : gauche pour, centre+droite contre, RN abstention,
// LIOT absent. Signature réelle PPPP-CCCCCA.
const IMPOT_PLANCHER: QuestionProximite = {
  id: 881,
  theme: "economie",
  positions: {
    "LFI-NFP": "pour", GDR: "pour", ECOS: "pour", SOC: "pour",
    DEM: "contre", EPR: "contre", HOR: "contre", DR: "contre", UDR: "contre",
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
  for (const g of ["DEM", "EPR", "HOR", "DR", "UDR"]) {
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
  for (const g of ["DEM", "EPR", "HOR", "DR", "UDR"]) {
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

// --- scoreVotant : proximité du « je » avec un DÉPUTÉ via ses votes individuels --------

test("scoreVotant : accord total quand l'élu vote comme le « je »", () => {
  // L'élu vote « pour » sur le scrutin 881 ; l'utilisateur répond « pour » → 100 %, base 1.
  const votes = { [scrutinUidDeId(881)]: "pour" };
  const s = scoreVotant([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, votes);
  assert.deepEqual(s, { pct: 1, comparable: 1 });
});

test("scoreVotant : désaccord total quand l'élu vote à l'inverse", () => {
  const votes = { [scrutinUidDeId(881)]: "contre" };
  const s = scoreVotant([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, votes);
  assert.deepEqual(s, { pct: 0, comparable: 1 });
});

test("scoreVotant : abstention / absence de l'élu ⇒ non comparable (null si rien à comparer)", () => {
  assert.equal(scoreVotant([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, { [scrutinUidDeId(881)]: "abstention" }), null);
  assert.equal(scoreVotant([IMPOT_PLANCHER], { 881: "pour" }, { economie: 1 }, {}), null); // pas de vote → absent
});

test("scoreVotant : pondération par thème identique au moteur des groupes", () => {
  const Q_SANTE: QuestionProximite = { id: 999, theme: "sante", positions: {} };
  const questions = [IMPOT_PLANCHER, Q_SANTE];
  const reponses = { 881: "pour" as const, 999: "pour" as const };
  // L'élu : accord en economie (pour), désaccord en sante (contre).
  const votes = { [scrutinUidDeId(881)]: "pour", [scrutinUidDeId(999)]: "contre" };
  // economie pesé 3, sante pesé 1 → (1*3 + 0*1)/4 = 0.75
  const s = scoreVotant(questions, reponses, { economie: 3, sante: 1 }, votes);
  assert.deepEqual(s, { pct: 0.75, comparable: 2 });
});

// --- Votes HORS TEST (questions « perso ») : plafond par thème -------------------------
const G2: GroupeProximite[] = [{ abrev: "A" }];
const qTest = (id: number, pos: "pour" | "contre"): QuestionProximite => ({ id, theme: "eco", positions: { A: pos } });
const qPerso = (id: number, pos: "pour" | "contre", theme = "eco"): QuestionProximite => ({ id, theme, positions: { A: pos }, origine: "perso" });

test("plafond : 10 votes hors test dans un thème à 3 questions, le test garde la moitié du poids", () => {
  const questions = [qTest(1, "pour"), qTest(2, "pour"), qTest(3, "pour"), ...Array.from({ length: 10 }, (_, i) => qPerso(100 + i, "contre"))];
  const reponses: Record<number, "pour" | "contre"> = { 1: "pour", 2: "pour", 3: "pour" };
  for (let i = 0; i < 10; i++) reponses[100 + i] = "pour"; // en désaccord avec A sur les 10 votes hors test
  const r = calculerProximite(questions, reponses, {}, G2);
  // test : 3/3 d'accord (1) ; hors test : 0/10 (0) ; w = min(1, 10/3) = 1 → (1 + 0) / 2.
  assert.equal(r.parTheme.eco.A.pct, 0.5);
  assert.equal(r.parTheme.eco.A.comparable, 13);
  assert.equal(r.parTheme.eco.A.comparableTest, 3);
  assert.equal(r.parTheme.eco.A.comparablePerso, 10);
  assert.equal(r.parTheme.eco.A.accord, 3);
  // Sans plafond, le ratio brut serait 3/13 : les votes hors test domineraient le thème.
  assert.ok(r.parTheme.eco.A.pct! > 3 / 13);
});

test("plafond : peu de votes hors test pèsent au prorata (w = comparablePerso / comparableTest)", () => {
  const questions = [qTest(1, "pour"), qTest(2, "pour"), qTest(3, "pour"), qTest(4, "pour"), qPerso(100, "contre")];
  const reponses: Record<number, "pour"> = { 1: "pour", 2: "pour", 3: "pour", 4: "pour", 100: "pour" };
  const r = calculerProximite(questions, reponses, {}, G2);
  // w = 1/4 → (1 + 0.25 × 0) / 1.25 = 0.8
  assert.ok(Math.abs(r.parTheme.eco.A.pct! - 0.8) < 1e-9);
});

test("thème sans question du test répondue : les votes hors test y comptent seuls", () => {
  const r = calculerProximite([qTest(1, "pour"), qPerso(200, "contre", "immigration")], { 1: "pour", 200: "contre" }, {}, G2);
  assert.equal(r.parTheme.immigration.A.pct, 1);
  assert.equal(r.parTheme.immigration.A.comparableTest, 0);
  // Global : moyenne des thèmes (eco 1, immigration 1).
  assert.equal(r.global[0].pct, 1);
});

test("effacer un vote hors test restaure le résultat ; le test seul ne bouge pas", () => {
  const test3 = [qTest(1, "pour"), qTest(2, "contre"), qTest(3, "pour")];
  const rep: Record<number, "pour" | "contre"> = { 1: "pour", 2: "pour", 3: "pour" };
  const testSeul = calculerProximite(test3, rep, {}, G2);
  const avec = calculerProximite([...test3, qPerso(300, "contre")], { ...rep, 300: "pour" }, {}, G2);
  assert.notEqual(avec.parTheme.eco.A.pct, testSeul.parTheme.eco.A.pct);
  // Réponse effacée : la question hors test n'est plus jouée, le résultat redevient celui du test.
  const efface = calculerProximite(test3, rep, {}, G2);
  assert.deepEqual(efface, testSeul);
});
