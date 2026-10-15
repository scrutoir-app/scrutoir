import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tauxAccord,
  phraseBandeau,
  votesCommuns,
  derniersVotes,
  ventilerThemes,
  ailesPapillon,
  phraseHorsSeuil,
  positionCourte,
  ligneVote,
} from "./confrontation";
import type { ConfrontationScrutin, ConfrontationTheme } from "./types";

const sc = (numero: number, date: string, posA: string, posB: string, extra: Partial<ConfrontationScrutin> = {}): ConfrontationScrutin => ({
  uid: `VTANR5L17V${numero}`, numero, date, titre: null, objet: null, sort_code: null, resume: null, posA, posB, ...extra,
});

const theme = (id: string, libelle: string, accords: ConfrontationScrutin[], desaccords: ConfrontationScrutin[]): ConfrontationTheme => ({
  id, libelle, ordre: 0, communs: accords.length + desaccords.length, accords, desaccords,
});

test("taux d'accord et phrase du bandeau (chiffres de la maquette : 232 sur 337)", () => {
  assert.equal(tauxAccord(232, 337), 69);
  assert.equal(tauxAccord(0, 0), null);
  assert.equal(phraseBandeau(232, 337), "232 votes pareils sur 337 en commun");
  assert.equal(phraseBandeau(1, 1), "1 vote pareil sur 1 en commun");
  assert.equal(phraseBandeau(0, 0), "Aucun vote en commun sur cette période");
});

test("derniers votes : tous thèmes confondus, plus récent d'abord, puis numéro décroissant", () => {
  const themes = [
    theme("economie", "Économie", [sc(8704, "2026-10-13", "pour", "pour")], [sc(8707, "2026-10-13", "contre", "pour"), sc(8000, "2026-06-01", "pour", "contre")]),
    theme("sante", "Santé", [], [sc(8705, "2026-10-13", "pour", "abstention")]),
  ];
  assert.deepEqual(derniersVotes(themes).map((s) => s.numero), [8707, 8705, 8704]);
  assert.deepEqual(votesCommuns(themes).map((s) => s.numero), [8707, 8705, 8704, 8000]);
  assert.equal(derniersVotes([], 3).length, 0);
});

test("thèmes : fiables du plus divergent au plus convergent, sous le seuil à part, silence ≠ désaccord", () => {
  const n = (k: number, p: string, q: string) => Array.from({ length: k }, (_, i) => sc(i, "2026-01-01", p, q));
  const themes = [
    theme("sante", "Santé", n(197, "pour", "pour"), n(60, "pour", "contre")),
    theme("economie", "Économie", n(3, "pour", "pour"), n(14, "pour", "contre")),
    theme("institutions", "Institutions", n(1, "pour", "pour"), n(4, "pour", "contre")),
    theme("travail", "Travail", n(1, "pour", "pour"), n(2, "pour", "contre")),
    theme("international", "International", n(2, "pour", "pour"), n(2, "pour", "contre")),
    theme("education", "Éducation", [], []),
  ];
  const v = ventilerThemes(themes, 5);
  assert.deepEqual(v.fiables.map((t) => [t.id, t.pct]), [["economie", 18], ["institutions", 20], ["sante", 77]]);
  assert.deepEqual(v.fiables[0], { id: "economie", libelle: "Économie", pareils: 3, opposes: 14, communs: 17, pct: 18 });
  assert.deepEqual(v.peu.map((t) => t.id), ["international", "travail"]);
  assert.deepEqual(v.aucun.map((t) => t.id), ["education"]);
});

test("barre papillon : chaque aile en % de sa moitié", () => {
  assert.deepEqual(ailesPapillon(3, 14), { gauche: 18, droite: 82 });
  assert.deepEqual(ailesPapillon(197, 60), { gauche: 77, droite: 23 });
  assert.deepEqual(ailesPapillon(0, 0), { gauche: 0, droite: 0 });
});

test("ligne grise : trop peu, aucun vote, et le rappel que ce n'est pas un désaccord", () => {
  assert.equal(
    phraseHorsSeuil([{ libelle: "International", communs: 4 }, { libelle: "Travail", communs: 3 }], [{ libelle: "Éducation" }]),
    "Trop peu de votes communs pour conclure : International (4), Travail (3). Aucun vote commun : Éducation. Ce n'est pas un désaccord.",
  );
  assert.equal(phraseHorsSeuil([], [{ libelle: "Agriculture" }]), "Aucun vote commun : Agriculture. Ce n'est pas un désaccord.");
  assert.equal(phraseHorsSeuil([], []), null);
});

test("pastilles en colonnes : Pour, Contre, Abst.", () => {
  assert.equal(positionCourte("pour"), "Pour");
  assert.equal(positionCourte("contre"), "Contre");
  assert.equal(positionCourte("abstention"), "Abst.");
  assert.equal(positionCourte("nonvotant"), "—");
});

test("ligne de vote : motion (texte visé, sans l'incise sur l'auteur), censure, vote sur l'ensemble (nom du texte), amendement (objet)", () => {
  const motion = ligneVote({ titre: "la motion de rejet préalable, déposée par M. Boris Vallaud, du projet de loi de finances pour 2027 (première lecture).", objet: null, date: "2026-10-13", sort_code: "rejete", type_vote: "scrutin public ordinaire", dossier_titre: null }, "2026");
  assert.deepEqual(motion, { meta: "Motion · 13 oct. · rejetée", titre: "Motion de rejet préalable du projet de loi de finances pour 2027" });
  const censure = ligneVote({ titre: "la motion de censure déposée en application de l'article 49, alinéa 3, de la Constitution par Mme X et 57 membres de l'Assemblée (1).", objet: null, date: "2026-02-02", sort_code: "rejete", type_vote: "motion de censure", dossier_titre: null }, "2026");
  assert.equal(censure.meta, "Motion de censure · 2 févr. · rejetée");
  assert.match(censure.titre, /^Motion de censure déposée en application de l'article 49, alinéa 3/);

  const ensemble = ligneVote({ titre: "la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants (première lecture).", objet: null, date: "2026-10-13", sort_code: "adopte", type_vote: "scrutin public solennel", dossier_titre: null }, "2026");
  assert.equal(ensemble.meta, "Vote sur l'ensemble · 13 oct. · adopté");
  assert.equal(ensemble.titre, "Proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants");

  const avecDossier = ligneVote({ titre: "la proposition de loi visant à X (première lecture).", objet: null, date: "2025-03-01", sort_code: "adopte", type_vote: null, dossier_titre: "Visant à X" }, "2026");
  assert.deepEqual(avecDossier, { meta: "Vote sur l'ensemble · 1er mars 2025 · adopté", titre: "Visant à X" });

  const amendement = ligneVote({ titre: "l'amendement n° 5 de Mme Thiébault-Martinez de rétablissement de l'article 46 (supprimé) de la proposition de loi apportant une réponse intégrale (seconde délibération) (première lecture).", objet: null, date: "2026-10-13", sort_code: "adopte", type_vote: null, dossier_titre: null }, "2026");
  assert.equal(amendement.meta, "Amendement · 13 oct. · adopté");
  assert.match(amendement.titre, /^Amendement n° 5 de Mme Thiébault-Martinez/);

  const sansIssue = ligneVote({ titre: "l'article 3 du projet de loi X", objet: null, date: null, sort_code: null, type_vote: null, dossier_titre: null }, "2026");
  assert.equal(sansIssue.meta, "Article");
});
