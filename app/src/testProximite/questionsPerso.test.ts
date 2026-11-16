import { test } from "node:test";
import assert from "node:assert/strict";
import { statutPerso, estQuasiUnanime, estTexteBudget, questionPerso, repartirPerso, type ScrutinStatut, type EntreePerso } from "./questionsPerso";
import { calculerProximite } from "./score";
import { encoderPartage, decoderPartage } from "./storage";

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

// --- Questions hors test : construction, répartition, partage --------------------------
const DETAIL = {
  numero: 5000,
  titre: "l'ensemble de la proposition de loi visant à …",
  date: "2026-11-12",
  categorie: "securite-justice",
  groupes: [
    { abrev: "LFI-NFP", pour: 70, contre: 0, abstention: 0 },
    { abrev: "EPR", pour: 40, contre: 40, abstention: 0 }, // égalité en tête : pas de position
    { abrev: "RN", pour: 0, contre: 120, abstention: 3 },
    { abrev: "LIOT", pour: 1, contre: 0, abstention: 9 },
    { abrev: "NI", pour: 3, contre: 0, abstention: 0 },
  ],
};

test("question hors test : position majoritaire de chaque groupe, thème du dossier d'abord", () => {
  const e = questionPerso(DETAIL, "immigration");
  assert.equal(e.statut, "compte");
  assert.equal(e.q.origine, "perso");
  assert.equal(e.q.id, 5000);
  assert.equal(e.q.theme, "immigration");
  assert.deepEqual(e.q.positions, { "LFI-NFP": "pour", RN: "contre", LIOT: "abstention" }); // EPR à égalité, NI hors hémicycle
  assert.deepEqual(e.q.decomptes?.NI, { pour: 3, contre: 0, abstention: 0 });
  assert.equal(questionPerso(DETAIL, null).q.theme, "securite-justice"); // sans dossier : catégorie du scrutin
});

const cache: Record<string, EntreePerso> = {
  "5000": questionPerso(DETAIL, null),
  "9895": questionPerso({ ...DETAIL, numero: 9895, titre: "l'ensemble du projet de loi de finances de fin de gestion pour 2026" }, null),
};

test("répartition : budget hors calcul, sans avis à part, réponse du test à une question retirée ignorée", () => {
  const reponses = { 5000: "pour", 9895: "contre", 881: "pour", 6000: "sans_avis", 7000: "pour", 289: "pour" } as const;
  const origines = { 5000: "scrutin", 9895: "scrutin", 6000: "scrutin", 7000: "scrutin", 289: "scrutin" } as const;
  // 881 : réponse du test (sans origine) à une question RETIRÉE du test → jamais reprise.
  // 289 : tranché depuis un scrutin mais c'est une question ACTUELLE du test → compte au test.
  const r = repartirPerso(reponses, origines, new Set([289]), cache);
  assert.deepEqual(r.comptees.map((q) => q.id), [5000]);
  assert.equal(r.horsCalcul, 1);
  assert.equal(r.sansAvis, 1);
  assert.deepEqual(r.manquants, [7000]);
});

test("partage : un lien avec des votes hors test redonne le même résultat", () => {
  const reponses = { 1: "pour", 5000: "contre", 9895: "pour" } as const;
  const origines = { 5000: "scrutin", 9895: "scrutin" } as const;
  const test1 = { id: 1, theme: "securite-justice", positions: { "LFI-NFP": "pour", RN: "contre" } } as const;
  const groupes = [{ abrev: "LFI-NFP" }, { abrev: "RN" }];
  const calcul = (rep: Record<number, "pour" | "contre" | "sans_avis">, ori: Record<number, "test" | "scrutin"> | undefined) => {
    const perso = repartirPerso(rep, ori, new Set([1]), cache);
    return calculerProximite([test1, ...perso.comptees], rep, {}, groupes);
  };
  const lien = decoderPartage(encoderPartage(reponses, {}, origines))!;
  assert.deepEqual(lien.origines, { 5000: "scrutin", 9895: "scrutin" });
  assert.deepEqual(calcul(lien.reponses, lien.origines), calcul(reponses, origines));
  // Un lien d'avant (sans origines) reste lisible : tout y vaut réponse au test.
  assert.equal(decoderPartage(encoderPartage({ 1: "pour" }))!.origines, undefined);
});
