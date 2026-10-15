import { test } from "node:test";
import assert from "node:assert/strict";
import {
  issueAccordee,
  titreEtContexte,
  regrouperParVote,
  decrireLigne,
  nbFiltresActifs,
  filtrerLignes,
  initiales,
  phraseLigne,
  type VoteSuiviSrc,
} from "./suivisFil";

const PLF = "du projet de loi de finances pour 2027 (première lecture).";
const AMDT = `l'amendement n° 312 de M. Le Coq supprimant l'article liminaire ${PLF}`;
const MOTION = `la motion de rejet préalable déposée par M. Boris Vallaud sur le projet de loi de finances pour 2027 (première lecture).`;
const ENSEMBLE = "l'ensemble de la proposition de loi visant à apporter une réponse intégrale aux violences sexuelles (première lecture).";

const v = (deputeUid: string, scrutinUid: string, o: Partial<VoteSuiviSrc> = {}): VoteSuiviSrc => ({
  deputeUid, scrutinUid, titre: AMDT, type_vote: "scrutin public ordinaire", dossier_ref: null,
  date: "2026-10-14", numero: +scrutinUid.slice(1), position: "pour", sort_code: "adopte", categorie: "economie", ...o,
});

test("issue accordée à la nature du vote, rien si l'issue manque", () => {
  assert.equal(issueAccordee("adopte", "amendement"), "adopté");
  assert.equal(issueAccordee("rejete", "motion"), "rejetée");
  assert.equal(issueAccordee("adopte", "partie"), "adoptée");
  assert.equal(issueAccordee("rejete", "censure"), "rejetée");
  assert.equal(issueAccordee("rejete", "ensemble"), "rejeté");
  assert.equal(issueAccordee(null, "motion"), null);
});

test("titre = ce qui a été voté, le texte de loi en contexte", () => {
  const a = titreEtContexte({ titre: AMDT }, null);
  assert.equal(a.titre, "Amendement n° 312 de M. Le Coq supprimant l'article liminaire");
  assert.equal(a.contexte, "Projet de loi de finances pour 2027");
  assert.equal(a.etiquette, "Amendement");
  const m = titreEtContexte({ titre: MOTION }, null);
  assert.equal(m.titre, "Motion de rejet préalable déposée par M. Boris Vallaud");
  assert.equal(m.contexte, "Projet de loi de finances pour 2027");
  // L'intitulé officiel du dossier prime sur celui tiré du scrutin.
  assert.equal(titreEtContexte({ titre: AMDT }, "Finances pour 2027").contexte, "Finances pour 2027");
});

test("vote sur l'ensemble : le titre est le texte, sans ligne de contexte", () => {
  const e = titreEtContexte({ titre: ENSEMBLE }, "Réponse intégrale aux violences sexuelles et sexistes");
  assert.equal(e.nature, "ensemble");
  assert.equal(e.etiquette, "Vote sur l'ensemble");
  assert.equal(e.titre, "Réponse intégrale aux violences sexuelles et sexistes");
  assert.equal(e.contexte, null);
  // Sans dossier : le texte tiré de l'intitulé, « visant à » retiré comme sur l'onglet Scrutins.
  assert.equal(titreEtContexte({ titre: ENSEMBLE }, null).titre, "Apporter une réponse intégrale aux violences sexuelles");
});

test("une ligne par vote, la position de chaque suivi dans l'ordre des puces", () => {
  const votes = [
    v("PO1", "V10", { position: "abstention" }),
    v("PA1", "V10", { position: "pour" }),
    v("PA1", "V9", { titre: MOTION, position: "contre", sort_code: "rejete", date: "2026-10-13" }),
    v("PO1", "V9", { titre: MOTION, position: "contre", sort_code: "rejete", date: "2026-10-13" }),
    v("PA1", "V8", { titre: ENSEMBLE, date: "2026-10-13", dossier_ref: "DLR1" }),
  ];
  const lignes = regrouperParVote(votes, ["PA1", "PO1"]);
  assert.deepEqual(lignes.map((l) => l.scrutinUid), ["V10", "V9", "V8"]); // date puis numéro, du plus récent
  assert.deepEqual(lignes[0].positions, [{ uid: "PA1", position: "pour" }, { uid: "PO1", position: "abstention" }]);
  assert.equal(lignes[2].positions.length, 1); // seul le suivi qui a voté
  // Libellés calculés à part, pour les seules lignes affichées.
  const dossiers = new Map([["DLR1", "Réponse intégrale aux violences sexuelles"]]);
  assert.equal(decrireLigne(lignes[0], dossiers, "2026").meta, "Amendement · 14 oct. · adopté");
  assert.equal(decrireLigne(lignes[1], dossiers, "2026").meta, "Motion · 13 oct. · rejetée");
  const e = decrireLigne(lignes[2], dossiers, "2026");
  assert.equal(e.titre, "Réponse intégrale aux violences sexuelles");
  assert.equal(e.contexte, null);
  // Un doublon (même suivi, même scrutin) ne fait pas deux pastilles.
  assert.equal(regrouperParVote([v("PA1", "V1"), v("PA1", "V1")], ["PA1"])[0].positions.length, 1);
  // Un suivi absent des puces (introuvable dans l'index) ne crée ni pastille ni ligne vide.
  assert.deepEqual(regrouperParVote([v("PA9", "V1"), v("PA1", "V2")], ["PA1"]).map((l) => l.scrutinUid), ["V2"]);
  // Année affichée hors année courante.
  assert.equal(decrireLigne(regrouperParVote([v("PA1", "V1", { date: "2025-06-04" })], ["PA1"])[0], new Map(), "2026").meta, "Amendement · 4 juin 2025 · adopté");
});

test("filtres : période, issue, et sélection de suivis (vide = tous)", () => {
  assert.equal(nbFiltresActifs("all", "all"), 0);
  assert.equal(nbFiltresActifs("6m", "rejete"), 2);

  const lignes = regrouperParVote(
    [
      v("PA1", "V3", { date: "2026-10-01" }),
      v("PO1", "V3", { date: "2026-10-01", position: "contre" }),
      v("PO1", "V2", { date: "2026-01-10", sort_code: "rejete" }),
      v("PA1", "V1", { date: "2025-01-10" }),
    ],
    ["PA1", "PO1"],
  );
  const f = (o: Partial<Parameters<typeof filtrerLignes>[1]>) =>
    filtrerLignes(lignes, { periode: "all", issue: "all", selection: new Set(), aujourdhui: "2026-10-15", ...o }).map((l) => l.scrutinUid);
  assert.deepEqual(f({}), ["V3", "V2", "V1"]);
  assert.deepEqual(f({ periode: "6m" }), ["V3"]);
  assert.deepEqual(f({ periode: "12m" }), ["V3", "V2"]);
  assert.deepEqual(f({ issue: "rejete" }), ["V2"]);
  // Fin de mois (borne de periode.ts) : un 31 août, « 6 mois » garde un vote du 28 février.
  const fev = regrouperParVote([v("PA1", "V9", { date: "2026-02-28" }), v("PA1", "V8", { date: "2026-02-27" })], ["PA1"]);
  assert.deepEqual(
    filtrerLignes(fev, { periode: "6m", issue: "all", selection: new Set(), aujourdhui: "2026-08-31" }).map((l) => l.scrutinUid),
    ["V9"],
  );
  assert.deepEqual(f({ issue: "adopte" }), ["V3", "V1"]);
  assert.deepEqual(f({ selection: new Set(["PO1"]) }), ["V3", "V2"]);
  // Avec une sélection, seules les pastilles des suivis choisis restent sous la ligne.
  const sel = filtrerLignes(lignes, { periode: "all", issue: "all", selection: new Set(["PO1"]), aujourdhui: "2026-10-15" });
  assert.deepEqual(sel[0].positions, [{ uid: "PO1", position: "contre" }]);
  assert.equal(lignes[0].positions.length, 2); // les lignes d'origine ne sont pas modifiées
});

test("initiales et phrase lue d'une ligne", () => {
  assert.equal(initiales("Audrey Abadie-Amiel"), "AA");
  assert.equal(initiales("Jean-Luc Mélenchon"), "JM");
  assert.equal(initiales("Charles de Courson"), "CC"); // particule sautée
  assert.equal(initiales("Marine Le Pen"), "ML");
  assert.equal(initiales("Cher"), "C");
  assert.equal(initiales(""), "?");
  const [l] = regrouperParVote([v("PA1", "V1"), v("PO1", "V1", { position: "abstention" })], ["PA1", "PO1"]);
  const noms: Record<string, string> = { PA1: "Audrey Abadie-Amiel", PO1: "LIOT" };
  const lib = (p: string) => (p === "pour" ? "Pour" : "Abstention");
  assert.equal(
    phraseLigne(l, decrireLigne(l, new Map(), "2026"), (u) => noms[u], lib),
    "Amendement · 14 oct. · adopté. Amendement n° 312 de M. Le Coq supprimant l'article liminaire. Projet de loi de finances pour 2027. Audrey Abadie-Amiel : pour, LIOT : abstention",
  );
});
