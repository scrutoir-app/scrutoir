import { test } from "node:test";
import assert from "node:assert/strict";
import { statutPerso, estQuasiUnanime, estTexteBudget, type ScrutinStatut } from "./questionsPerso";

// Groupes d'un vote ordinaire : la gauche pour, la droite contre (les groupes se départagent).
const CLIVANT: ScrutinStatut["groupes"] = [
  { abrev: "LFI-NFP", pour: 70, contre: 0, abstention: 0 },
  { abrev: "SOC", pour: 60, contre: 2, abstention: 0 },
  { abrev: "EPR", pour: 3, contre: 80, abstention: 1 },
  { abrev: "RN", pour: 0, contre: 120, abstention: 0 },
];
const UNANIME: ScrutinStatut["groupes"] = [
  { abrev: "LFI-NFP", pour: 70, contre: 0, abstention: 0 },
  { abrev: "EPR", pour: 80, contre: 1, abstention: 0 },
  { abrev: "RN", pour: 0, contre: 2, abstention: 100 },
  { abrev: "NI", pour: 0, contre: 5, abstention: 0 }, // non-inscrits : pas un groupe
];

test("vote ordinaire sur un texte : compte", () => {
  assert.equal(statutPerso({ titre: "l'ensemble de la proposition de loi visant à protéger les enfants", groupes: CLIVANT }), "compte");
});

test("budget : vote sur l'ensemble ou une partie exclu, amendement et article d'un budget comptés", () => {
  const ensemble = statutPerso({
    titre: "l'ensemble du projet de loi de finances de fin de gestion pour 2026 (première lecture).",
    groupes: CLIVANT,
  });
  assert.deepEqual(ensemble, {
    exclu: "budget",
    nature: "un budget",
    raison: "un budget regroupe des centaines de mesures : un pour ou un contre ne dit pas lesquelles tu soutiens.",
  });
  // PLFSS repéré par l'intitulé du DOSSIER quand celui du scrutin ne le dit pas.
  const plfss = statutPerso({ titre: "l'ensemble du projet de loi (nouvelle lecture).", dossier_titre: "Projet de loi de financement de la sécurité sociale pour 2026", groupes: CLIVANT });
  assert.equal(typeof plfss === "object" && plfss.exclu, "budget");
  const partie = statutPerso({ titre: "l'ensemble de la première partie du projet de loi de finances pour 2026", groupes: CLIVANT });
  assert.equal(typeof partie === "object" && partie.exclu, "budget");
  // Une mesure lisible d'un budget, elle, compte.
  assert.equal(statutPerso({ titre: "l'amendement n° 230 de M. X après l'article 18 du projet de loi de financement de la sécurité sociale pour 2025", groupes: CLIVANT }), "compte");
  assert.equal(statutPerso({ titre: "l'article 4 du projet de loi de finances pour 2026", groupes: CLIVANT }), "compte");
  assert.ok(estTexteBudget("Projet de loi portant règlement du budget et approbation des comptes de l'année 2024"));
});

test("motion de censure, motion de procédure, déclaration : exclues", () => {
  const raison = "une motion porte sur le sort du gouvernement ou sur la procédure, pas sur le fond d'une mesure.";
  assert.deepEqual(statutPerso({ titre: "la motion de censure déposée en application de l'article 49, alinéa 3", type_vote: "motion de censure", groupes: CLIVANT }), {
    exclu: "censure", nature: "une motion de censure", raison,
  });
  assert.deepEqual(statutPerso({ titre: "la motion de rejet préalable, déposée par Mme X, du projet de loi …", groupes: CLIVANT }), {
    exclu: "procedure", nature: "une motion de procédure", raison,
  });
  assert.deepEqual(statutPerso({ titre: "la déclaration du Gouvernement suivie d'un débat", groupes: CLIVANT }), {
    exclu: "declaration", nature: "une déclaration du gouvernement", raison,
  });
});

test("vote quasi unanime : exclu (aucun groupe pour face à un groupe contre)", () => {
  assert.ok(estQuasiUnanime(UNANIME));
  assert.ok(!estQuasiUnanime(CLIVANT));
  assert.deepEqual(statutPerso({ titre: "l'ensemble de la proposition de loi relative à …", groupes: UNANIME }), {
    exclu: "unanime", nature: null, raison: "ce vote ne les départage pas.",
  });
});
