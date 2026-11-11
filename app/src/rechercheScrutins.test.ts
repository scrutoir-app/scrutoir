import { test } from "node:test";
import assert from "node:assert/strict";
import { memoireScrutins, retenirScrutins, vueRecherche } from "./rechercheScrutins";

// Onglet Scrutins, « une seule recherche visible » (maquette du 11/11/2026). Le rendu lui-même
// (clavier, focus) se vérifie dans le navigateur : ici, la règle d'affichage et la mémoire.

test("état sans requête : pas de barre en haut, le bloc central est la seule entrée", () => {
  for (const q of ["", "   ", "\n"]) {
    const v = vueRecherche("recherche", q);
    assert.equal(v.barreEnHaut, false, `barre en haut pour « ${q} »`);
    assert.equal(v.blocCentral, true);
    assert.equal(v.sousOnglets, true);
  }
});

test("saisie : toujours exactement UNE entrée de recherche, jamais deux ni zéro", () => {
  // Frappe lettre à lettre puis effacement : à chaque état, un seul champ visible (le même
  // TextInput, qui passe du bloc central à la barre du haut sans être recréé).
  for (const q of ["", "l", "lo", "log", "logement", "logemen", "l", ""]) {
    const v = vueRecherche("recherche", q);
    assert.equal(Number(v.blocCentral) + Number(v.barreEnHaut), 1, `« ${q} »`);
  }
});

test("avec résultats : barre en haut, sous-onglets masqués, requête conservée", () => {
  const v = vueRecherche("recherche", "logement");
  assert.deepEqual(v, { sousOnglets: false, blocCentral: false, barreEnHaut: true });
  retenirScrutins({ onglet: "recherche", q: "logement" });
  assert.equal(memoireScrutins().q, "logement");
});

test("effacer la requête ramène le bloc central et retire la barre du haut", () => {
  retenirScrutins({ onglet: "recherche", q: "logement" });
  retenirScrutins({ q: "" }); // bouton effacer
  const v = vueRecherche(memoireScrutins().onglet, memoireScrutins().q);
  assert.deepEqual(v, { sousOnglets: true, blocCentral: true, barreEnHaut: false });
});

test("retour depuis une page scrutin : même requête, barre du haut comprise", () => {
  // L'onglet est démonté quand on ouvre un texte ou un scrutin, puis remonté au retour : il
  // repart de la mémoire de session.
  retenirScrutins({ onglet: "recherche", q: "retraites", theme: null });
  const auRetour = { ...memoireScrutins() };
  assert.equal(auRetour.q, "retraites");
  assert.equal(vueRecherche(auRetour.onglet, auRetour.q).barreEnHaut, true);
});

test("sous-onglet Textes : ni bloc de recherche ni barre, les sous-onglets restent", () => {
  for (const q of ["", "logement"]) {
    assert.deepEqual(vueRecherche("textes", q), { sousOnglets: true, blocCentral: false, barreEnHaut: false });
  }
});
