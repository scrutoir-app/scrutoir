import { test } from "node:test";
import assert from "node:assert/strict";
import { ligneVote, reponseCompte, texteTiroir, titreTiroir, encartTiroir, statutEncart } from "./texteVote";
import { statutPerso } from "./questionsPerso";

// Copie de la maquette validée « Corriger un vote déduit », mot pour mot.

const BUDGET = statutPerso({ titre: "l'ensemble du projet de loi de finances pour 2026", groupes: [] });
const UNANIME = statutPerso({ titre: "l'ensemble de la proposition de loi …", groupes: [] });

test("ligne sous la pastille", () => {
  assert.equal(ligneVote({ reponse: undefined, compte: false }), "Déduit de ton profil. Pas d'accord ? Touche la pastille.");
  assert.equal(ligneVote({ reponse: "pour", compte: true }), "Réponse notée : pour. Elle entre dans le calcul de ta proximité avec les groupes.");
  assert.equal(
    ligneVote({ reponse: "contre", compte: false }),
    "Réponse notée : contre. En revanche, elle ne change pas le calcul de ta proximité avec les groupes.",
  );
  assert.equal(ligneVote({ reponse: "sans_avis", compte: false }), "Ta réponse : sans avis. Plus aucune déduction ici.");
});

test("une réponse compte : question du test, ou scrutin hors test qui départage sur une mesure lisible", () => {
  assert.ok(reponseCompte({ reponse: "pour", dansTest: true, origine: "test", statut: BUDGET }));
  assert.ok(reponseCompte({ reponse: "contre", dansTest: false, origine: "scrutin", statut: "compte" }));
  assert.ok(!reponseCompte({ reponse: "pour", dansTest: false, origine: "scrutin", statut: BUDGET }));
  assert.ok(!reponseCompte({ reponse: "pour", dansTest: false, origine: "scrutin", statut: UNANIME }));
  // Réponse du test à une question RETIRÉE : jamais (elle ne revient pas comme vote hors test).
  assert.ok(!reponseCompte({ reponse: "pour", dansTest: false, origine: "test", statut: "compte" }));
  assert.ok(!reponseCompte({ reponse: "sans_avis", dansTest: true, origine: "test", statut: "compte" }));
});

test("tiroir : titre et texte", () => {
  assert.equal(titreTiroir(undefined), "Ce qu'on a déduit");
  assert.equal(titreTiroir("pour"), "Ton vote sur ce scrutin");
  assert.equal(
    texteTiroir({ reponse: undefined, verdict: { niveau: "deduit", sens: "oppose", penche: "contre" }, sortCode: "adopte" }),
    "D'après tes réponses au test, on pense que tu aurais voté contre. L'Assemblée l'a adopté, d'où « Pas comme toi ». Et toi ?",
  );
  assert.equal(
    texteTiroir({ reponse: undefined, verdict: { niveau: "deduit", sens: "align", penche: "contre" }, sortCode: "rejete" }),
    "D'après tes réponses au test, on pense que tu aurais voté contre. L'Assemblée l'a rejeté, d'où « Comme toi ». Et toi ?",
  );
  assert.equal(
    texteTiroir({ reponse: undefined, verdict: { niveau: "deduit", sens: "partage", penche: null }, sortCode: "adopte" }),
    "Ton profil ne permet pas de trancher ce vote. Et toi ?",
  );
  assert.equal(
    texteTiroir({ reponse: "sans_avis", verdict: { niveau: "sans_avis", sens: null }, sortCode: "adopte" }),
    "Tu as répondu « sans avis ». Change d'avis quand tu veux.",
  );
});

test("tiroir : encart (compté, budget, quasi unanime ; une question du test compte toujours)", () => {
  assert.equal(
    encartTiroir("compte"),
    "Pour ou contre entre dans le calcul de ta proximité avec les groupes. Sans avis n'y change rien. Ta réponse reste sur ton téléphone.",
  );
  assert.equal(
    encartTiroir(BUDGET),
    "Ce scrutin porte sur un budget. Ta réponse sera notée, en revanche elle ne changera pas le calcul de ta proximité avec les groupes, car un budget regroupe des centaines de mesures : un pour ou un contre ne dit pas lesquelles tu soutiens.",
  );
  assert.equal(
    encartTiroir(UNANIME),
    "Presque tous les groupes ont voté pareil. Ta réponse sera notée, en revanche elle ne changera pas le calcul de ta proximité avec les groupes, car ce vote ne les départage pas.",
  );
  assert.equal(statutEncart(true, BUDGET), "compte");
  assert.equal(statutEncart(false, BUDGET), BUDGET);
});
