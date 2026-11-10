import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { focusDeLaSemaine, focusPublie, votants, type ScrutinCandidat } from "./focusSemaine";
import { construireEdition, objetDuScrutin, texteDuScrutin, type DossierSrc, type ScrutinSrc } from "./hebdo";

// Extrait figé des données publiées (numéro, date, décomptes) : les données ne sont pas dans le
// dépôt, et ces cas doivent rester vrais tels que validés le 10/11/2026.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "focusSemaine.fixture.json"), "utf8")) as {
  lignes: [number, string, number, number, number][];
};
const REELS: ScrutinCandidat[] = fixture.lignes.map(([numero, date, pour, contre, abstention]) => ({
  uid: `VTANR5L17V${numero}`,
  numero,
  date,
  pour,
  contre,
  abstention,
}));

// Tableau validé : vendredi de l'édition → scrutin attendu.
const ATTENDUS: { vendredi: string; numero: number; votants: number; cas: string }[] = [
  { vendredi: "2026-10-16", numero: 8706, votants: 570, cas: "égalité avec le n° 8705, le plus élevé gagne" },
  { vendredi: "2026-10-23", numero: 8895, votants: 387, cas: "motion de rejet" },
  { vendredi: "2026-10-30", numero: 9203, votants: 305, cas: "vote sur l'ensemble d'un texte" },
  { vendredi: "2026-11-06", numero: 9759, votants: 460, cas: "semaine sans vote sur l'ensemble d'un texte" },
];

for (const a of ATTENDUS) {
  test(`focus du ${a.vendredi} : n° ${a.numero}, ${a.votants} votants (${a.cas})`, () => {
    const f = focusDeLaSemaine(REELS, a.vendredi);
    assert.ok(f);
    assert.equal(f.scrutin.numero, a.numero);
    assert.equal(f.votants, a.votants);
    assert.equal(f.repli, false);
    assert.equal(f.vendrediSource, a.vendredi);
    assert.deepEqual(focusPublie(f), { uid: `VTANR5L17V${a.numero}`, numero: a.numero, votants: a.votants });
  });
}

test("égalité 8705 / 8706 : même date, même nombre de votants, le numéro départage", () => {
  const n = (k: number) => REELS.find((s) => s.numero === k)!;
  assert.equal(votants(n(8705)), votants(n(8706)));
  assert.equal(n(8705).date, n(8706).date);
});

test("fenêtre vide (édition du 24 avril 2026) : le focus de la semaine précédente, signalé", () => {
  const f = focusDeLaSemaine(REELS, "2026-04-24");
  assert.ok(f);
  assert.equal(f.repli, true);
  assert.equal(f.vendredi, "2026-04-24");
  assert.equal(f.vendrediSource, "2026-04-17");
  assert.equal(f.scrutin.numero, 6184);
  assert.equal(f.votants, 530);
  // Exactement le focus que l'édition du 17 avril avait elle-même.
  assert.deepEqual(focusDeLaSemaine(REELS, "2026-04-17")?.scrutin, f.scrutin);
});

test("plusieurs semaines vides (été 2026) : on remonte jusqu'à la dernière édition qui a eu des scrutins", () => {
  const f = focusDeLaSemaine(REELS, "2026-08-14");
  assert.ok(f);
  assert.equal(f.repli, true);
  assert.equal(f.vendrediSource, "2026-07-24");
  assert.equal(f.scrutin.numero, 8427);
  assert.equal(f.votants, 561);
});

// --- Règle, sur des cas construits ------------------------------------------------------------

const S = (numero: number, date: string | null, pour: number, contre: number, abstention: number): ScrutinCandidat => ({
  uid: `U${numero}`,
  numero,
  date,
  pour,
  contre,
  abstention,
});

test("votants = pour + contre + abstention (valeurs absentes comptées 0)", () => {
  assert.equal(votants({ pour: 10, contre: 5, abstention: 2 }), 17);
  assert.equal(votants({ pour: null, contre: 3, abstention: null }), 3);
});

test("égalité de votants : la date la plus récente l'emporte, avant le numéro", () => {
  // Fenêtre du vendredi 2026-10-16 : 2026-10-09 → 2026-10-15.
  const f = focusDeLaSemaine([S(20, "2026-10-12", 50, 50, 0), S(10, "2026-10-14", 60, 40, 0)], "2026-10-16");
  assert.equal(f?.scrutin.numero, 10);
});

test("bornes : le vendredi J-7 compte, le vendredi de parution part dans l'édition suivante", () => {
  const scrs = [S(1, "2026-10-09", 300, 0, 0), S(2, "2026-10-16", 500, 0, 0)];
  assert.equal(focusDeLaSemaine(scrs, "2026-10-16")?.scrutin.numero, 1);
  assert.equal(focusDeLaSemaine(scrs, "2026-10-23")?.scrutin.numero, 2);
});

test("aucune exclusion : un amendement qui réunit le plus de votants est le focus", () => {
  const f = focusDeLaSemaine([S(1, "2026-10-12", 100, 100, 0), S(2, "2026-10-13", 300, 200, 10)], "2026-10-16");
  assert.equal(f?.scrutin.numero, 2);
});

test("scrutin sans date ignoré ; aucun scrutin public avant la fenêtre : pas de focus", () => {
  assert.equal(focusDeLaSemaine([S(1, null, 500, 0, 0)], "2026-10-16"), null);
  assert.equal(focusDeLaSemaine([], "2026-10-16"), null);
  // Seulement des scrutins POSTÉRIEURS : rien à reprendre.
  assert.equal(focusDeLaSemaine([S(1, "2026-10-20", 100, 0, 0)], "2026-10-16"), null);
});

// --- Objet du vote et titre du texte (rendu du focus) ----------------------------------------

test("objet du vote lu dans l'intitulé des quatre focus du tableau", () => {
  const o = (titre: string, type_vote = "scrutin public ordinaire") => objetDuScrutin({ titre, type_vote });
  assert.equal(o("la proposition de loi organique visant à adapter l'autorité judiciaire à la lutte contre les violences sexuelles et intrafamiliales (première lecture).", "scrutin public solennel"), "Vote sur l'ensemble du texte");
  assert.equal(o("la motion de rejet préalable, déposée par Mme Mathilde Panot, du projet de loi de financement de la sécurité sociale pour 2027 (première lecture)."), "Motion de rejet préalable");
  assert.equal(o("l'ensemble de la proposition de loi créant un corps de fonctionnaires de catégorie B pour les accompagnants d’élèves en situation de handicap (première lecture)."), "Vote sur l'ensemble du texte");
  assert.equal(o("la première partie du projet de loi de finances pour 2027 (première lecture).", "scrutin public solennel"), "Première partie");
  assert.equal(o("l'amendement n° 1764 de Mme Feld à l'article 3 du projet de loi de finances pour 2025 (première lecture)."), "Amendement n° 1764");
  assert.equal(o("l'article 21 de la proposition de loi apportant une réponse intégrale (première lecture)."), "Article 21");
});

test("titre du texte : le même que celui de l'édition « La semaine à l'Assemblée »", () => {
  const dossiers: DossierSrc[] = [{ ref: "DLR1", titre: "Projet de loi de financement de la sécurité sociale pour 2027", categorie: "sante" }];
  const scrs: ScrutinSrc[] = [
    { uid: "A", numero: 1, date: "2026-10-20", titre: "la motion de rejet préalable, déposée par Mme X, du projet de loi de financement de la sécurité sociale pour 2027 (première lecture).", sort_code: "rejete", dossier_ref: null, pour: 150, contre: 237, abstention: 0 },
    { uid: "B", numero: 2, date: "2026-10-21", titre: "l'amendement n° 12 de M. Y à l'article 3 du projet de loi de financement de la sécurité sociale pour 2027 (première lecture).", sort_code: "adopte", dossier_ref: "DLR1", pour: 80, contre: 60, abstention: 0 },
    { uid: "C", numero: 3, date: "2026-10-21", titre: "la proposition de loi visant à protéger les abeilles (première lecture).", sort_code: "adopte", dossier_ref: null, pour: 40, contre: 2, abstention: 0 },
  ];
  const t = texteDuScrutin("2026-10-23", "A", scrs, dossiers);
  assert.ok(t);
  const edition = construireEdition("2026-10-23", scrs, dossiers);
  const titres = edition.themes.flatMap((th) => th.textes.map((x) => x.titre));
  assert.ok(titres.includes(t.titre));
  assert.equal(t.titre, "Projet de loi de financement de la sécurité sociale pour 2027");
  assert.equal(texteDuScrutin("2026-10-23", "C", scrs, dossiers)?.titre, "Protéger les abeilles");
  // Hors de la fenêtre : aucun texte.
  assert.equal(texteDuScrutin("2026-10-30", "A", scrs, dossiers), null);
});
