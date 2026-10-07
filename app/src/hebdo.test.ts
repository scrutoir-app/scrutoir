import { test } from "node:test";
import assert from "node:assert/strict";
import {
  vendrediParu,
  editionDuScrutin,
  fenetre,
  construireEdition,
  editionsAvecContenu,
  natureScrutin,
  titreDepuisScrutin,
  titreCourt,
  rattacherDossier,
  textesFocus,
  metaFocus,
  libelleDate,
  libelleFenetre,
  libelleParution,
  libelleReprise,
  ventilation,
  type ScrutinSrc,
  type DossierSrc,
} from "./hebdo";

// 2026-10-09 est un vendredi.
test("parution : le vendredi même, puis les jours suivants jusqu'au jeudi", () => {
  assert.equal(vendrediParu("2026-10-09"), "2026-10-09");
  assert.equal(vendrediParu("2026-10-10"), "2026-10-09");
  assert.equal(vendrediParu("2026-10-15"), "2026-10-09");
  assert.equal(vendrediParu("2026-10-08"), "2026-10-02");
});

test("un scrutin appartient au premier vendredi STRICTEMENT après sa date", () => {
  assert.equal(editionDuScrutin("2026-10-08"), "2026-10-09"); // jeudi
  assert.equal(editionDuScrutin("2026-10-02"), "2026-10-09"); // vendredi → édition suivante
  assert.equal(editionDuScrutin("2026-10-05"), "2026-10-09"); // lundi
  assert.equal(editionDuScrutin("2026-10-09"), "2026-10-16");
});

test("fenêtre : vendredi J-7 au jeudi J-1, cohérente avec editionDuScrutin", () => {
  assert.deepEqual(fenetre("2026-10-09"), { debut: "2026-10-02", fin: "2026-10-08" });
  for (let d = 2; d <= 8; d++) assert.equal(editionDuScrutin(`2026-10-0${d}`), "2026-10-09");
  // Passage d'année.
  assert.deepEqual(fenetre("2027-01-01"), { debut: "2026-12-25", fin: "2026-12-31" });
});

test("libellés de date", () => {
  assert.equal(libelleFenetre("2026-10-09", "2026"), "Du 2 au 8 octobre");
  assert.equal(libelleFenetre("2026-10-02", "2026"), "Du 25 septembre au 1er octobre");
  assert.equal(libelleFenetre("2027-01-01", "2027"), "Du 25 au 31 décembre 2026");
  assert.equal(libelleFenetre("2026-01-02", "2026"), "Du 26 décembre 2025 au 1er janvier 2026");
  assert.equal(libelleFenetre("2025-06-27", "2026"), "Du 20 au 26 juin 2025");
  assert.equal(libelleParution("2026-10-09", "2026"), "Édition du vendredi 9 octobre");
  assert.equal(libelleParution("2026-05-01", "2027"), "Édition du vendredi 1er mai 2026");
});

test("nature d'un scrutin lue dans son intitulé", () => {
  assert.equal(natureScrutin({ titre: "l'amendement n° 12 de M. X à l'article 2 du projet de loi …" }), "amendement");
  assert.equal(natureScrutin({ titre: "l’ensemble de la proposition de loi visant à …" }), "ensemble");
  assert.equal(natureScrutin({ titre: "l'article 4 de la proposition de loi relative à …" }), "article");
  assert.equal(natureScrutin({ titre: "la motion de rejet préalable, déposée par Mme X, du projet de loi …" }), "procedure");
  assert.equal(natureScrutin({ titre: "la motion de censure déposée …", type_vote: "motion de censure" }), "censure");
});

test("titre extrait d'un scrutin non rattaché à un dossier", () => {
  assert.equal(
    titreDepuisScrutin("l'article 3 du projet de loi d'urgence pour Mayotte (première lecture)."),
    "Projet de loi d'urgence pour Mayotte",
  );
  assert.equal(titreDepuisScrutin("la déclaration du Gouvernement."), "Déclaration du Gouvernement");
});

const D: DossierSrc[] = [
  { ref: "DLR1", titre: "Réformer les bourses sur critères sociaux", categorie: "education" },
  { ref: "DLR2", titre: "Projet de loi d'urgence agricole", categorie: "agriculture" },
  { ref: "DLR3", titre: "Abrogation du Code noir", categorie: null },
];
const s = (uid: string, date: string, titre: string, extra: Partial<ScrutinSrc> = {}): ScrutinSrc => ({
  uid, numero: +uid.replace(/\D/g, ""), date, titre, sort_code: "adopte", type_vote: "scrutin public ordinaire", ...extra,
});
const SCR: ScrutinSrc[] = [
  // Dans la fenêtre du 9 octobre (2 → 8 octobre)
  s("V1", "2026-10-06", "l'amendement n° 1 à l'article 2 du projet de loi d'urgence agricole (première lecture).", { dossier_ref: "DLR2", categorie: "economie", sort_code: "rejete" }),
  s("V2", "2026-10-06", "l'amendement n° 2 à l'article 2 du projet de loi d'urgence agricole (première lecture).", { dossier_ref: "DLR2", categorie: "economie" }),
  s("V3", "2026-10-07", "l'article 2 du projet de loi d'urgence agricole (première lecture).", { dossier_ref: "DLR2", categorie: "economie" }),
  s("V4", "2026-10-07", "l'ensemble de la proposition de loi visant à réformer les bourses (deuxième lecture).", { dossier_ref: "DLR1", categorie: "education", type_vote: "scrutin public solennel" }),
  s("V5", "2026-10-08", "l'ensemble de la proposition de loi portant abrogation du Code noir.", { dossier_ref: "DLR3", sort_code: "rejete" }),
  s("V6", "2026-10-08", "l'article 3 du projet de loi d'urgence pour Mayotte (première lecture).", { categorie: "logement" }),
  // Hors fenêtre
  s("V7", "2026-10-09", "l'amendement n° 9 à l'article 4 du projet de loi d'urgence agricole.", { dossier_ref: "DLR2" }),
  s("V8", "2026-10-01", "l'amendement n° 8 à l'article 1 du projet de loi d'urgence agricole.", { dossier_ref: "DLR2" }),
];

test("édition : regroupe par thème puis par texte, hors fenêtre exclu", () => {
  const e = construireEdition("2026-10-09", SCR, D);
  assert.equal(e.nbScrutins, 6);
  assert.equal(e.nbTextes, 4);
  // Le vote solennel passe en tête, « Autres textes » (thème non attribué) en dernier.
  assert.deepEqual(e.themes.map((t) => t.categorie), ["education", "agriculture", "logement", null]);
  const agri = e.themes[1].textes[0];
  assert.equal(agri.titre, "Projet de loi d'urgence agricole");
  assert.equal(agri.genreLabel, "Projet de loi");
  assert.equal(agri.lecture, "1re lecture");
  assert.equal(agri.nb, 3);
  assert.equal(ventilation(agri.comptes), "2 amendements · 1 article");
  assert.equal(agri.ensemble, null); // pas de vote sur l'ensemble : on ne dit rien de l'issue
  // Le thème du DOSSIER prime sur celui des scrutins (agriculture, pas economie).
  const edu = e.themes[0].textes[0];
  assert.equal(edu.solennel, true);
  assert.equal(edu.ensemble, "adopte");
  assert.equal(edu.genreLabel, "Proposition de loi");
  assert.equal(edu.lecture, "2e lecture");
  const autre = e.themes[3].textes[0];
  assert.equal(autre.ensemble, "rejete");
  // Scrutin sans dossier : titre extrait de l'intitulé, ouvert par son uid.
  const mayotte = e.themes[2].textes[0];
  assert.equal(mayotte.dossierRef, null);
  assert.equal(mayotte.titre, "Projet de loi d'urgence pour Mayotte");
  assert.equal(mayotte.scrutinUid, "V6");
});

test("motion de censure rattachée au texte qui l'a provoquée", () => {
  const e = construireEdition("2026-10-09", [
    s("V10", "2026-10-05", "la motion de censure déposée en application de l'article 49, alinéa 3 …", { dossier_ref: "DLR2", type_vote: "motion de censure", sort_code: "rejete" }),
    s("V11", "2026-10-05", "l'article 1 du projet de loi d'urgence agricole.", { dossier_ref: "DLR2" }),
  ], D);
  const t = e.themes[0].textes[0];
  assert.equal(t.censure, "rejete");
  assert.equal(t.genreLabel, "Projet de loi");
});

test("semaine vide et liste des éditions disponibles", () => {
  const e = construireEdition("2026-07-31", SCR, D);
  assert.equal(e.nbScrutins, 0);
  assert.deepEqual(e.themes, []);
  assert.deepEqual(editionsAvecContenu(SCR), ["2026-10-02", "2026-10-09", "2026-10-16"]);
});

test("reprise : mentionnée après une longue interruption des scrutins publics, pas sinon", () => {
  const avecPause = [
    s("R1", "2026-07-21", "l'ensemble du projet de loi relatif à la protection des enfants (première lecture)."),
    s("R2", "2026-10-01", "l'article 5 de la proposition de loi apportant une réponse intégrale (première lecture)."),
    s("R3", "2026-10-02", "l'article 6 de la proposition de loi apportant une réponse intégrale (première lecture)."),
  ];
  const r = construireEdition("2026-10-02", avecPause, D).reprise;
  assert.deepEqual(r, { le: "2026-10-01", depuis: "2026-07-21" });
  assert.equal(libelleReprise(r!, "2026"), "Reprise le 1er octobre : aucun scrutin public depuis le 21 juillet.");
  // La semaine suivante enchaîne sans pause : rien à dire.
  assert.equal(construireEdition("2026-10-09", avecPause, D).reprise, null);
  // Semaine de suspension (moins de 14 jours sans scrutin) : pas de mention.
  const courte = [s("C1", "2026-02-12", "l'article 1 du projet de loi X."), s("C2", "2026-02-23", "l'article 2 du projet de loi X.")];
  assert.equal(construireEdition("2026-02-27", courte, D).reprise, null);
  // Édition vide, ou tout premier scrutin connu : rien.
  assert.equal(construireEdition("2026-07-31", SCR, D).reprise, null);
  assert.equal(construireEdition("2026-10-02", [avecPause[1]], D).reprise, null);
  // Changement d'année : l'année est précisée quand elle diffère de l'année courante.
  const noel = [s("N1", "2025-12-18", "l'article 1 du projet de loi Y."), s("N2", "2026-01-13", "l'article 2 du projet de loi Y.")];
  assert.equal(libelleReprise(construireEdition("2026-01-16", noel, D).reprise!, "2026"), "Reprise le 13 janvier : aucun scrutin public depuis le 18 décembre 2025.");
});

test("titre court : seuls les mots d'amorce partent, jamais de reformulation", () => {
  assert.equal(titreCourt("Proposition de loi visant à protéger les mineurs isolés"), "Protéger les mineurs isolés");
  assert.equal(titreCourt("Projet de loi portant habilitation de l'assemblée de Martinique"), "Habilitation de l'assemblée de Martinique");
  assert.equal(titreCourt("Proposition de résolution européenne visant à rejeter le projet d'accord"), "Rejeter le projet d'accord");
  assert.equal(titreCourt("Projet de loi de finances pour 2026"), "Projet de loi de finances pour 2026");
  assert.equal(titreCourt("Fin de vie"), "Fin de vie");
});

test("scrutin non rattaché : retrouve son dossier par l'intitulé, sans faux positif", () => {
  const ds: DossierSrc[] = [
    { ref: "A", titre: "Retrouver la confiance et l'équilibre dans les rapports locatifs", categorie: "logement" },
    { ref: "B", titre: "Soutenir le Danemark et le Groenland et œuvrer en faveur d'une plus grande coopération en matière de défense", categorie: null },
    { ref: "C", titre: "Fin de vie", categorie: "sante" },
    { ref: "D", titre: "Projet de loi de finances pour 2026", categorie: "economie" },
    { ref: "E", titre: "Projet de loi de finances rectificative pour 2026", categorie: "economie" },
  ];
  assert.equal(rattacherDossier("Proposition de loi pour retrouver la confiance et l'équilibre dans les rapports locatifs", ds), "A");
  assert.equal(rattacherDossier("Proposition de résolution européenne visant à soutenir le Danemark et le Groenland et à œuvrer en faveur d'une plus grande coopération en matière de défense", ds), "B");
  assert.equal(rattacherDossier("Proposition de loi relative à l'accompagnement de la fin de vie", ds), null); // titre trop court pour conclure
  assert.equal(rattacherDossier("Projet de loi de finances rectificative pour 2026", ds), "E");
  assert.equal(rattacherDossier("Projet de loi de finances pour 2026", ds), "D");
});

test("focus : textes retenus par le critère, regroupés, du plus récent au plus ancien", () => {
  const ds: DossierSrc[] = [
    { ref: "B", titre: "Réformer les bourses sur critères sociaux et lutter contre la précarité étudiante", categorie: "education" },
    { ref: "V", titre: "Protéger les enfants et lutter contre les violences en milieu scolaire", categorie: "education" },
    { ref: "X", titre: "Proroger l'accès à certaines écoles de service public", categorie: null },
    { ref: "A", titre: "Projet de loi d'urgence agricole", categorie: "agriculture" },
  ];
  const scr: ScrutinSrc[] = [
    s("V30", "2026-05-28", "l'amendement n° 3 à l'article 1 de la proposition de loi visant à protéger les enfants et à lutter contre les violences en milieu scolaire (première lecture).", { dossier_ref: "V" }),
    s("V31", "2026-06-01", "l'ensemble de la proposition de loi visant à protéger les enfants et à lutter contre les violences en milieu scolaire (première lecture).", { dossier_ref: "V" }),
    s("V32", "2026-06-11", "l'ensemble de la proposition de loi visant à réformer les bourses sur critères sociaux et à lutter contre la précarité étudiante (première lecture).", { dossier_ref: "B" }),
    s("V33", "2025-02-18", "l'article unique de la proposition de loi visant à proroger l'accès à certaines écoles de service public.", { dossier_ref: "X" }),
    s("V34", "2026-06-02", "l'ensemble du projet de loi d'urgence agricole.", { dossier_ref: "A" }),
  ];
  const motsCles = /(?<![\wÀ-ÿ])(écoles?|scolaires?|élèves?|étudiant(?:e|s|es)?)(?![\wÀ-ÿ])/i;
  const res = textesFocus({ motsCles }, scr, ds);
  assert.deepEqual(res.map((t) => t.dossierRef), ["B", "V", "X"]);
  assert.equal(res[1].nb, 2);
  assert.equal(metaFocus(res[0]), "Proposition de loi, 1 scrutin public, texte adopté en 1re lecture");
  assert.deepEqual(textesFocus({ motsCles, exclure: ["X"] }, scr, ds).map((t) => t.dossierRef), ["B", "V"]);
  assert.equal(libelleDate("2026-06-01"), "1er juin 2026");
});
