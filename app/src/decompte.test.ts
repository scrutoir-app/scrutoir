import { test } from "node:test";
import assert from "node:assert/strict";
import { decompteClair, decompteGroupe } from "./decompte";

test("décompte en clair : positions non nulles, dans l'ordre pour · contre · abst.", () => {
  assert.equal(decompteClair({ pour: 14, contre: 0, abstention: 0 }), "14 pour");
  assert.equal(decompteClair({ pour: 10, contre: 0, abstention: 1 }), "10 pour, 1 abst.");
  assert.equal(decompteClair({ pour: 0, contre: 17, abstention: 0 }), "17 contre");
  assert.equal(decompteClair({ pour: 1312, contre: 2, abstention: 3 }), "1 312 pour, 2 contre, 3 abst.");
  assert.equal(decompteClair({ pour: 0, contre: 0, abstention: 0 }), "");
});

test("groupe unanime : autant de voix que de sièges, et du même avis", () => {
  assert.deepEqual(decompteGroupe({ pour: 23, contre: 0, abstention: 0 }, 23), { etat: "unanime", position: "pour", texte: "Unanime : 23 pour" });
  assert.equal(decompteGroupe({ pour: 0, contre: 121, abstention: 0 }, 121).texte, "Unanime : 121 contre");
});

test("une seule position sans tout le groupe : pas « unanime »", () => {
  // LIOT, 23 sièges, 19 pour (patrimoine immobilier de l'État, 21/07/2026).
  assert.deepEqual(decompteGroupe({ pour: 19, contre: 0, abstention: 0 }, 23), { etat: "seul", position: "pour", texte: "19 pour, aucun contre" });
  assert.equal(decompteGroupe({ pour: 0, contre: 5, abstention: 0 }, 7).texte, "5 contre, aucun pour");
  assert.equal(decompteGroupe({ pour: 0, contre: 0, abstention: 66 }, 70).texte, "66 abst., aucun pour ni contre");
  // Effectif inconnu : jamais « unanime ».
  assert.equal(decompteGroupe({ pour: 23, contre: 0, abstention: 0 }).etat, "seul");
});

test("groupe divisé : toutes les positions écrites", () => {
  assert.deepEqual(decompteGroupe({ pour: 18, contre: 1, abstention: 4 }, 23), { etat: "divise", position: null, texte: "18 pour, 1 contre, 4 abst." });
  assert.equal(decompteGroupe({ pour: 22, contre: 0, abstention: 1 }, 23).etat, "divise");
});

test("aucun vote exprimé", () => {
  assert.deepEqual(decompteGroupe({ pour: 0, contre: 0, abstention: 0 }, 23), { etat: "aucun", position: null, texte: "aucun vote exprimé" });
});
