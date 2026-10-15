import { test } from "node:test";
import assert from "node:assert/strict";
import { dateLongue, libelleScrutin, intituleOfficiel, libelleProgression, directionGlisse, decisionGeste, reponseDeTouche } from "./carte";

test("date en toutes lettres, 1er pour le premier du mois", () => {
  assert.equal(dateLongue("2025-07-09"), "9 juillet 2025");
  assert.equal(dateLongue("2026-06-01"), "1er juin 2026");
  assert.equal(dateLongue("2025-12-31T00:00:00"), "31 décembre 2025");
  assert.equal(dateLongue(null), null);
  assert.equal(dateLongue("n'importe quoi"), null);
  assert.equal(dateLongue("2025-13-01"), null);
});

test("repère du scrutin : n° et date, ou n° seul", () => {
  assert.equal(libelleScrutin(2975, "2025-07-09"), "Scrutin n° 2975 du 9 juillet 2025");
  assert.equal(libelleScrutin(2975, null), "Scrutin n° 2975");
});

test("intitulé officiel : texte AN gardé tel quel, initiale en capitale", () => {
  assert.equal(
    intituleOfficiel("l'ensemble du projet de loi de programmation pour la refondation de Mayotte (texte de la commission mixte paritaire)."),
    "L'ensemble du projet de loi de programmation pour la refondation de Mayotte (texte de la commission mixte paritaire)."
  );
  assert.equal(intituleOfficiel("  l’ensemble de la proposition de loi  "), "L’ensemble de la proposition de loi");
  assert.equal(intituleOfficiel(""), null);
  assert.equal(intituleOfficiel(undefined), null);
});

test("progression neutre : carte N sur total, sans compte à rebours", () => {
  assert.equal(libelleProgression(0, 8), "Carte 1 sur 8");
  assert.equal(libelleProgression(11, 12), "Carte 12 sur 12");
});

test("direction du glissé : l'axe dominant l'emporte, le bas ne répond rien", () => {
  assert.equal(directionGlisse(3, -4), null); // zone morte
  assert.equal(directionGlisse(40, -10), "pour");
  assert.equal(directionGlisse(-40, 10), "contre");
  assert.equal(directionGlisse(10, -40), "sans_avis");
  assert.equal(directionGlisse(10, 40), null);
});

test("décision au lâcher : même seuil pour Pour, Contre et Sans avis", () => {
  const seuil = 90;
  assert.equal(decisionGeste(91, 0, seuil), "pour");
  assert.equal(decisionGeste(-91, 0, seuil), "contre");
  assert.equal(decisionGeste(0, -91, seuil), "sans_avis");
  assert.equal(decisionGeste(89, 0, seuil), null);
  assert.equal(decisionGeste(0, -89, seuil), null);
  assert.equal(decisionGeste(0, 200, seuil), null); // vers le bas : la carte revient
  // Diagonale : l'axe dominant décide, sur son propre seuil.
  assert.equal(decisionGeste(60, -120, seuil), "sans_avis");
  assert.equal(decisionGeste(120, -60, seuil), "pour");
});

test("clavier : les trois réponses sans geste", () => {
  assert.equal(reponseDeTouche("ArrowLeft"), "contre");
  assert.equal(reponseDeTouche("ArrowRight"), "pour");
  assert.equal(reponseDeTouche("ArrowUp"), "sans_avis");
  assert.equal(reponseDeTouche("ArrowDown"), null);
  assert.equal(reponseDeTouche("Enter"), null);
});
