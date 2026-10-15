import { test } from "node:test";
import assert from "node:assert/strict";
import { indexerTextes, type ScrutinSrc, type DossierSrc, type VoteReference } from "./hebdo";
import {
  dateCourte,
  dateLongue,
  decompteCourt,
  statutCarte,
  statutPage,
  resumeScrutins,
  libelleOntCompte,
  libelleEcart,
  raisonsEcrites,
  titreLigne,
  metaLigne,
  ventilerTexte,
  resumeSorts,
  rechercherTextes,
  phraseResultats,
} from "./textes";

const s = (uid: string, date: string, titre: string, o: Partial<ScrutinSrc> = {}): ScrutinSrc => ({
  uid, numero: +uid.slice(1), date, titre, sort_code: "adopte", type_vote: "scrutin public ordinaire", ...o,
});
const COMPTES = { amendement: 0, article: 0, partie: 0, ensemble: 0, procedure: 0, declaration: 0, censure: 0, autre: 0 };
const ref = (o: Partial<VoteReference>): VoteReference => ({
  uid: "V1", numero: 1, date: "2026-10-13", sort_code: "adopte", pour: 503, contre: 0, abstention: 67,
  nature: "ensemble", final: true, solennel: true, lecture: "1re lecture", objet: null, ...o,
});
const VSS = "de la proposition de loi apportant une réponse intégrale aux violences sexuelles (première lecture).";

test("dates et décompte : courts, l'année hors année courante, le zéro écrit", () => {
  assert.equal(dateCourte("2026-10-13", "2026"), "13 oct.");
  assert.equal(dateCourte("2026-06-01", "2026"), "1er juin");
  assert.equal(dateCourte("2024-11-28", "2026"), "28 nov. 2024");
  assert.equal(dateCourte("2026-06-04", null), "4 juin 2026"); // résultats de recherche : toujours l'année
  assert.equal(dateLongue("2026-10-13"), "13 octobre 2026");
  assert.equal(decompteCourt({ pour: 1503, contre: 0, abstention: 67 }), "1 503 pour · 0 contre · 67 abst.");
});

test("statut d'une carte : vote sur l'ensemble, texte en cours, vote marquant, rien", () => {
  const auj = "2026-10-15";
  assert.deepEqual(statutCarte({ reference: ref({}), derniereDate: "2026-10-13" }, auj), { sort: "adopte", label: "Adopté", decompte: "503 pour · 0 contre · 67 abst." });
  assert.equal(statutCarte({ reference: ref({ sort_code: "rejete" }), derniereDate: "2024-10-31" }, auj).label, "Rejeté");
  // Pas de vote sur l'ensemble, dernier scrutin de moins de 7 jours : en cours (même avec une motion).
  const motion = ref({ final: false, nature: "procedure", sort_code: "rejete", objet: "Motion de rejet préalable", pour: 149, contre: 236, abstention: 0 });
  assert.deepEqual(statutCarte({ reference: motion, derniereDate: "2026-10-14" }, auj), { sort: null, label: "En cours : pas encore de vote sur l'ensemble", decompte: null });
  assert.equal(statutCarte({ reference: null, derniereDate: "2026-10-09" }, auj).label, "En cours : pas encore de vote sur l'ensemble");
  // À 7 jours et au-delà : le vote le plus marquant, sinon on dit l'absence de vote sur l'ensemble.
  assert.deepEqual(statutCarte({ reference: motion, derniereDate: "2026-10-08" }, auj), { sort: "rejete", label: "Motion de rejet préalable rejetée", decompte: "149 pour · 236 contre · 0 abst." });
  // L'article unique d'une convention clôt le texte : jamais « en cours », même récent.
  assert.deepEqual(statutCarte({ reference: ref({ final: false, nature: "article", objet: "Article unique", pour: 28, contre: 5, abstention: 2 }), derniereDate: "2026-10-12" }, auj), { sort: "adopte", label: "Article unique adopté", decompte: "28 pour · 5 contre · 2 abst." });
  assert.deepEqual(statutCarte({ reference: null, derniereDate: "2024-11-28" }, auj), { sort: null, label: "Pas de vote sur l'ensemble en scrutin public", decompte: null });
  // Votes qui closent l'examen, jamais « en cours » : motion de rejet adoptée, motion de censure.
  const rejetAdopte = ref({ final: false, nature: "procedure", sort_code: "adopte", objet: "Motion de rejet préalable", pour: 250, contre: 200, abstention: 0 });
  assert.equal(statutCarte({ reference: rejetAdopte, derniereDate: "2026-10-13" }, auj).label, "Motion de rejet préalable adoptée");
  const censure = ref({ final: false, nature: "censure", sort_code: "rejete", objet: "Motion de censure", pour: 135, contre: 0, abstention: 0 });
  assert.deepEqual(statutCarte({ reference: censure, derniereDate: "2026-10-14" }, auj), { sort: "rejete", label: "Motion de censure rejetée", decompte: "135 pour · 0 contre · 0 abst." });
  // Motion de censure seule (son propre texte) : même libellé, jamais un « Rejeté » nu.
  assert.equal(statutCarte({ reference: { ...censure, final: true }, derniereDate: "2026-10-14" }, auj).label, "Motion de censure rejetée");
  assert.equal(statutPage({ reference: { ...censure, final: true }, derniereDate: "2025-02-12" }, auj).label, "Motion de censure rejetée");
});

test("statut de la page : la lecture du vote sur l'ensemble", () => {
  const auj = "2026-10-15";
  assert.equal(statutPage({ reference: ref({}), derniereDate: "2026-10-13" }, auj).label, "Adopté en 1re lecture");
  assert.equal(statutPage({ reference: ref({ sort_code: "rejete", lecture: "nouvelle lecture" }), derniereDate: "2026-10-13" }, auj).label, "Rejeté en nouvelle lecture");
  assert.equal(statutPage({ reference: ref({ lecture: "texte de la CMP" }), derniereDate: "2026-10-13" }, auj).label, "Texte de la CMP adopté");
  assert.equal(statutPage({ reference: ref({ lecture: null }), derniereDate: "2026-10-13" }, auj).label, "Adopté");
});

test("résumé des scrutins d'un texte : amendements, articles s'ils sont plusieurs", () => {
  assert.equal(resumeScrutins({ nb: 230, comptes: { ...COMPTES, ensemble: 1, article: 54, amendement: 175 } }), "230 scrutins, dont 175 amendements et 54 articles");
  assert.equal(resumeScrutins({ nb: 21, comptes: { ...COMPTES, ensemble: 1, article: 1, amendement: 19 } }), "21 scrutins, dont 19 amendements");
  assert.equal(resumeScrutins({ nb: 30, comptes: { ...COMPTES, amendement: 30 } }), "30 scrutins, tous sur des amendements");
  assert.equal(resumeScrutins({ nb: 5, comptes: { ...COMPTES, ensemble: 1, article: 4 } }), "5 scrutins, dont 4 articles");
  assert.equal(resumeScrutins({ nb: 2, comptes: { ...COMPTES, ensemble: 1, procedure: 1 } }), "2 scrutins");
  assert.equal(resumeScrutins({ nb: 1, comptes: { ...COMPTES, ensemble: 1 } }), null);
  assert.equal(libelleOntCompte(21), "21 amendements qui ont compté");
  assert.equal(libelleOntCompte(1), "1 amendement qui a compté");
  assert.equal(libelleOntCompte(0), null);
});

test("amendements qui ont compté : la raison écrite sur la ligne, le titre sans redite", () => {
  const am = (titre: string, pour: number, contre: number, sort_code = "adopte") => ({ titre, pour, contre, sort_code, type_vote: null });
  const retab = am(`l'amendement n° 5 de Mme Thiébault-Martinez de rétablissement de l'article 46 (supprimé) ${VSS}`, 213, 111);
  assert.deepEqual(raisonsEcrites(retab), ["rétablit l'article 46"]);
  assert.equal(titreLigne(retab, true), "Amendement n° 5 de Mme Thiébault-Martinez");
  assert.equal(titreLigne(retab), "Amendement n° 5 de Mme Thiébault-Martinez de rétablissement de l'article 46 (supprimé)");
  const serre = am(`l'amendement n° 4 (rect.) de Mme Thiébault-Martinez à l'article 44 ${VSS}`, 167, 177, "rejete");
  assert.deepEqual(raisonsEcrites(serre), ["écart de 10 voix"]);
  assert.equal(titreLigne(serre, true), "Amendement n° 4 (rect.) de Mme Thiébault-Martinez, à l'article 44");
  const supp = am(`l'amendement n° 244 de M. Ménagé et les amendements identiques suivants de suppression de l'article 62 (examen prioritaire) ${VSS}`, 121, 118);
  assert.deepEqual(raisonsEcrites(supp), ["supprime l'article 62", "écart de 3 voix"]);
  assert.equal(titreLigne(supp, true), "Amendement n° 244 de M. Ménagé et identiques");
  const collee = am(`l'amendement n° 31 de rétablissement de l'article 7 (supprimé)(examen prioritaire) ${VSS}`, 60, 20);
  assert.equal(titreLigne(collee, true), "Amendement n° 31");
  const reserve = am(`l'amendement n° 32 de suppression de l'article 9 (précédemment réservé) ${VSS}`, 60, 20);
  assert.deepEqual(raisonsEcrites(reserve), ["supprime l'article 9"]);
  assert.equal(titreLigne(reserve, true), "Amendement n° 32");
  assert.deepEqual(raisonsEcrites(am(`l'amendement n° 9 à l'article 2 ${VSS}`, 50, 51, "rejete")), ["écart d'une voix"]);
  assert.deepEqual(raisonsEcrites(am(`l'amendement n° 8 à l'article 2 ${VSS}`, 49, 49, "rejete")), ["à égalité"]);
  assert.deepEqual(raisonsEcrites(am(`l'amendement n° 7 à l'article 2 ${VSS}`, 10, 90, "rejete")), []);
  assert.equal(libelleEcart({ pour: 1200, contre: 0 }), "écart de 1 200 voix");
});

test("méta d'une ligne : date, précision hors lecture, autre lecture, raisons", () => {
  const art = s("V8701", "2026-10-13", `l'article 32 bis ${VSS.replace(" (première lecture).", "")} (seconde délibération) (première lecture).`);
  assert.equal(metaLigne(art, { annee: "2026", lectureRef: "1re lecture" }), "13 oct. · seconde délibération");
  const deux = s("V10", "2025-03-02", "l'article 3 de la proposition de loi visant à X (deuxième lecture).");
  assert.equal(metaLigne(deux, { annee: "2026", lectureRef: "1re lecture" }), "2 mars 2025 · 2e lecture");
  assert.equal(metaLigne(deux, { annee: "2026", lectureRef: "2e lecture", raisons: ["écart de 2 voix"] }), "2 mars 2025 · écart de 2 voix");
});

test("page d'un texte : le vote de référence en tête, le reste rangé, récents d'abord", () => {
  const scrs = [
    s("V1", "2026-10-01", `l'amendement n° 1 à l'article 2 ${VSS}`, { pour: 10, contre: 90, sort_code: "rejete" }),
    s("V2", "2026-10-02", `l'amendement n° 2 à l'article 2 ${VSS}`, { pour: 88, contre: 86 }),
    s("V3", "2026-10-03", `l'article 2 ${VSS}`, { pour: 80, contre: 2 }),
    s("V4", "2026-10-04", `la motion de rejet préalable, déposée par M. X, ${VSS}`, { sort_code: "rejete" }),
    s("V5", "2026-10-13", `la proposition de loi apportant une réponse intégrale aux violences sexuelles (première lecture).`, { pour: 503, contre: 0 }),
    s("V6", "2026-10-05", `l'amendement n° 6 de rétablissement de l'article 3 (supprimé) ${VSS}`, { pour: 100, contre: 20 }),
  ];
  const v = ventilerTexte(scrs, "V5");
  assert.deepEqual(v.comptent.map((x) => x.uid), ["V6", "V2"]);
  assert.equal(v.nbAmendements, 3);
  assert.deepEqual(v.autresAmendements.map((x) => x.uid), ["V1"]);
  assert.deepEqual(v.articles.map((x) => x.uid), ["V3"]);
  assert.deepEqual(v.autres.map((x) => x.uid), ["V4"]); // V5 (référence) n'est pas répété
  assert.equal(resumeSorts(scrs), "4 adoptés, 2 rejetés");
  assert.equal(resumeSorts([{ sort_code: "adopte" }]), "1 adopté");
});

test("recherche regroupée par texte : tous les scrutins qui citent la saisie, rangés par texte", () => {
  const D: DossierSrc[] = [
    { ref: "R1", titre: "Abrogation de la retraite à 64 ans", categorie: "travail" },
    { ref: "R2", titre: "Revalorisation des pensions agricoles", categorie: "agriculture" },
    { ref: "R3", titre: "Projet de loi de finances pour 2027", categorie: "economie" },
  ];
  const scrs = [
    s("V1", "2024-11-28", "l'amendement n° 1 à l'article premier de la proposition de loi visant à abroger le recul de l'âge de départ à la retraite.", { dossier_ref: "R1" }),
    s("V2", "2024-11-28", "l'amendement n° 2 à l'article premier de la proposition de loi visant à abroger le recul de l'âge.", { dossier_ref: "R1" }),
    s("V3", "2026-06-04", "l'ensemble de la proposition de loi visant à revaloriser les pensions de RETRAITE agricoles (première lecture).", { dossier_ref: "R2" }),
    s("V4", "2026-10-14", "l'amendement n° 3 après l'article 2 du projet de loi de finances pour 2027 (première lecture).", { dossier_ref: "R3" }),
  ];
  const r = rechercherTextes("Retraité", indexerTextes(scrs, D)); // casse et accents ignorés
  assert.deepEqual(r.textes.map((t) => [t.texte.cle, t.citations]), [["R2", 1], ["R1", 1]]);
  assert.deepEqual(r.scrutins.map((x) => x.uid), ["V3", "V1"]);
  // L'intitulé du dossier suffit, même si aucun scrutin ne cite le mot.
  assert.deepEqual(rechercherTextes("abrogation", indexerTextes(scrs, D)).textes.map((t) => [t.texte.cle, t.citations]), [["R1", 0]]);
  assert.deepEqual(rechercherTextes("r", indexerTextes(scrs, D)), { textes: [], scrutins: [] });
});

test("phrase de résultat : textes, scrutins, députés, élision", () => {
  assert.equal(phraseResultats(3, 49, "retraite", 0), "3 textes et 49 scrutins parlent de retraite. Aucun député ne porte ce nom.");
  assert.equal(phraseResultats(1, 1, "eau"), "1 texte et 1 scrutin parlent d'eau.");
  assert.equal(phraseResultats(1, 0, "abrogation", 2), "1 texte parle d'abrogation. 2 députés correspondent à ta recherche.");
  assert.equal(phraseResultats(0, 0, "zzz", 1), "Aucun texte ne parle de zzz. 1 député correspond à ta recherche.");
});
