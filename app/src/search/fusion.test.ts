import test from "node:test";
import assert from "node:assert/strict";
import { cleDossier, dedupParDossier, rechercherSujet } from "./fusion";
import { filtrerLexical } from "./lexical";
import { suggererThemes } from "./suggestions";
import type { ScrutinResume } from "../types";

const CATS = [
  { id: "ecologie", libelle: "Écologie & Climat" },
  { id: "agriculture", libelle: "Agriculture & Alimentation" },
  { id: "logement", libelle: "Logement & Territoires" },
];

test("suggererThemes : préfixe accentué/insensible à la casse", () => {
  assert.deepEqual(suggererThemes("ecolo", CATS).map((t) => t.id), ["ecologie"]);
  assert.deepEqual(suggererThemes("AGRI", CATS).map((t) => t.id), ["agriculture"]);
});

test("suggererThemes : moins de 2 lettres ou sans correspondance → rien", () => {
  assert.deepEqual(suggererThemes("e", CATS), []);
  assert.deepEqual(suggererThemes("carburant", CATS), []);
});

const S = (uid: string, titre: string, date = "2025-01-01"): ScrutinResume => ({
  uid, numero: null, date, titre, objet: null, sort_code: null, sort_libelle: null,
});

// — Clé de dossier (dérivée du titre, l'index n'a pas d'id de dossier) —
test("cleDossier : amendements/articles/ensemble d'un texte partagent la clé", () => {
  const a = cleDossier("l'amendement n° 15 de Mme Regol à l'article premier de la proposition de loi relative au droit à l'aide à mourir (première lecture).");
  const b = cleDossier("l'ensemble de la proposition de loi relative au droit à l'aide à mourir (deuxième lecture).");
  const c = cleDossier("l'article 3 de la proposition de loi relative au droit à l'aide à mourir (nouvelle lecture).");
  assert.equal(a, b);
  assert.equal(b, c);
  assert.match(a, /proposition de loi relative au droit a l aide a mourir/);
});

test("cleDossier : deux lois différentes → clés différentes", () => {
  assert.notEqual(
    cleDossier("l'ensemble de la proposition de loi visant à la nationalisation d'ArcelorMittal"),
    cleDossier("l'ensemble du projet de loi de finances pour 2026")
  );
});

// — Dédup par dossier (§11 : résultats noyés d'amendements) —
test("dedupParDossier : 1 entrée/dossier, privilégie le texte entier (« l'ensemble »)", () => {
  const liste = [
    S("a1", "l'amendement n° 1 à l'article 2 de la proposition de loi relative au droit à l'aide à mourir (première lecture).", "2025-05-01"),
    S("a2", "l'article 5 de la proposition de loi relative au droit à l'aide à mourir (première lecture).", "2025-05-02"),
    S("ens", "l'ensemble de la proposition de loi relative au droit à l'aide à mourir (première lecture).", "2025-05-03"),
  ];
  const out = dedupParDossier(liste);
  assert.equal(out.length, 1);
  assert.equal(out[0].uid, "ens", "doit garder le vote sur le texte entier");
});

test("dedupParDossier : à défaut d'« ensemble », garde la lecture la plus récente", () => {
  const liste = [
    S("v1", "l'article 2 de la proposition de loi visant à la nationalisation d'ArcelorMittal (première lecture).", "2024-03-01"),
    S("v2", "l'article 2 de la proposition de loi visant à la nationalisation d'ArcelorMittal (deuxième lecture).", "2025-06-01"),
  ];
  const out = dedupParDossier(liste);
  assert.equal(out.length, 1);
  assert.equal(out[0].uid, "v2", "doit garder la lecture la plus récente");
});

test("dedupParDossier : préserve l'ordre de pertinence (1re occurrence)", () => {
  const liste = [
    S("x", "l'ensemble de la proposition de loi A"),
    S("y", "l'ensemble de la proposition de loi B"),
    S("x2", "l'article 1 de la proposition de loi A"),
  ];
  const out = dedupParDossier(liste);
  assert.deepEqual(out.map((s) => s.uid), ["x", "y"]);
});

// — Recherche lexicale par mot-clé (repli/complément sur l'exposé) —
test("filtrerLexical : trouve le mot-clé présent dans l'exposé (pas dans le titre)", () => {
  const corpus = {
    a: "amendement budget carburant ticpe gazole transport", // exposé carburant
    b: "logement loyer habitat construction",
    c: "carburant essence pompe prix energie",
  };
  assert.deepEqual(filtrerLexical(corpus, "carburant").sort(), ["a", "c"]);
});

test("filtrerLexical : exige TOUS les mots-clés (ET), ignore mots-outils", () => {
  const corpus = {
    a: "carburant prix pompe energie",
    b: "carburant transport maritime",
  };
  // « prix » + « carburant » → seul a ; « le », « du » ignorés (mots-outils/courts)
  assert.deepEqual(filtrerLexical(corpus, "le prix du carburant"), ["a"]);
});

test("filtrerLexical : requête sans mot-clé porteur → aucun résultat", () => {
  assert.deepEqual(filtrerLexical({ a: "carburant prix" }, "les"), []);
});

// — Repli lexical (§11 : modèle indisponible / hors-ligne) —
// En Node (pas de navigateur), le modèle n'est pas chargeable → rechercherSujet doit
// retomber proprement : aucune section Sujet, semantiqueDispo = false.
test("rechercherSujet : repli si sémantique indisponible (Node = pas de modèle)", async () => {
  const r = await rechercherSujet("écologie", []);
  assert.deepEqual(r.sujet, []);
  assert.equal(r.semantiqueDispo, false);
});

test("rechercherSujet : un numéro de scrutin ne déclenche pas la recherche par sujet", async () => {
  const r = await rechercherSujet("scrutin 7380", []);
  assert.deepEqual(r.sujet, []);
  assert.equal(r.semantiqueDispo, false);
});
