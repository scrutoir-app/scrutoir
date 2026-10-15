import { test } from "node:test";
import assert from "node:assert/strict";
import { ceQuiEstVote, classerScrutin } from "./typeScrutin";

// Intitulés RÉELS de l'Open Data AN (17e législature), recopiés tels quels.
const v = (titre: string, type_vote = "scrutin public ordinaire") => ceQuiEstVote({ titre, type_vote });

test("amendement : titre = l'amendement et son lieu, texte en lien, lecture en méta", () => {
  const r = v("l'amendement n° 3919 de M. Sansu à l'article 2 du projet de loi de finances pour 2027 (première lecture).");
  assert.equal(r.nature, "amendement");
  assert.equal(r.etiquette, "Amendement");
  assert.equal(r.titre, "Amendement n° 3919 de M. Sansu, à l'article 2");
  assert.equal(r.texte, "Projet de loi de finances pour 2027");
  assert.deepEqual(r.precisions, ["Première lecture"]);
});

test("amendement : identiques, « après l'article », rect. et examen prioritaire gardés", () => {
  assert.equal(
    v("l'amendement n° 637 (rect.) de M. Jean-Philippe Tanguy et l'amendement identique suivant après l'article 3 du projet de loi de finances pour 2027 (première lecture).").titre,
    "Amendement n° 637 (rect.) de M. Jean-Philippe Tanguy et l'amendement identique suivant, après l'article 3",
  );
  const r = v("l'amendement n° 1146 (rect.) de M. Balanant à l'article 30 (examen prioritaire) de la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants (première lecture).");
  assert.equal(r.titre, "Amendement n° 1146 (rect.) de M. Balanant, à l'article 30 (examen prioritaire)");
  assert.equal(r.texte, "Proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants");
});

test("sous-amendement : la virgule va avant l'article, pas avant l'amendement visé", () => {
  const r = v("le sous-amendement n° 3981 de Mme Coggia à l'amendement n° 2564 de M. Coquerel après l'article 3 du projet de loi de finances pour 2027 (première lecture).");
  assert.equal(r.nature, "sous-amendement");
  assert.equal(r.etiquette, "Sous-amendement");
  assert.equal(r.titre, "Sous-amendement n° 3981 de Mme Coggia à l'amendement n° 2564 de M. Coquerel, après l'article 3");
});

test("coquilles de l'AN : la nature est reconnue, le texte n'est pas corrigé", () => {
  assert.equal(v("le sous-amendmeent n° 196 de M. Léaument à l'amendement n° 109 de M. Boudié à l'article 3 de la proposition de loi visant à renforcer la sécurité, la rétention administrative et la prévention des risques d'attentat (première lecture).").nature, "sous-amendement");
  const a = v("l'amenedement n° 187 de M. Renault à l'article 35 (examen prioritaire) du projet de loi de finances pour 2026 (nouvelle lecture).");
  assert.equal(a.nature, "amendement");
  assert.equal(a.titre, "Amenedement n° 187 de M. Renault, à l'article 35 (examen prioritaire)");
  assert.deepEqual(a.precisions, ["Nouvelle lecture"]);
  const b = v("l'aticle 6 du projet de loi sur la justice criminelle et le respect des victimes (première lecture).");
  assert.equal(b.nature, "article");
  assert.equal(b.titre, "Aticle 6");
});

test("article : titre = l'article, seconde délibération gardée en méta", () => {
  const r = v("l'article 21 de la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants (première lecture).");
  assert.equal(r.nature, "article");
  assert.equal(r.etiquette, "Article");
  assert.equal(r.titre, "Article 21");
  const s = v("l'article liminaire du projet de loi de finances pour 2026 (seconde délibération) (première lecture).");
  assert.equal(s.titre, "Article liminaire");
  assert.equal(s.texte, "Projet de loi de finances pour 2026");
  assert.deepEqual(s.precisions, ["Seconde délibération", "Première lecture"]);
});

test("vote sur l'ensemble, intitulé avec « l'ensemble »", () => {
  const r = v("l'ensemble du projet de loi relatif à la protection des enfants (première lecture).", "scrutin public solennel");
  assert.equal(r.nature, "ensemble");
  assert.equal(r.etiquette, "Vote sur l'ensemble");
  assert.equal(r.titre, "Vote sur l'ensemble du projet de loi");
  assert.equal(r.texte, "Projet de loi relatif à la protection des enfants");
  const cmp = v("l'ensemble de la proposition de loi visant à moderniser la gestion du patrimoine immobilier de l'État (texte de la commission mixte paritaire).", "scrutin public solennel");
  assert.equal(cmp.titre, "Vote sur l'ensemble de la proposition de loi");
  assert.deepEqual(cmp.precisions, ["Texte de la commission mixte paritaire"]);
});

test("PIÈGE : le vote solennel « la proposition de loi … (première lecture) » est un vote sur l'ensemble", () => {
  const r = v("la proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants (première lecture).", "scrutin public solennel");
  assert.equal(r.nature, "ensemble");
  assert.equal(r.titre, "Vote sur l'ensemble de la proposition de loi");
  assert.equal(r.texte, "Proposition de loi apportant une réponse intégrale au phénomène des violences sexuelles et sexistes contre les femmes et les enfants");
  const org = v("la proposition de loi organique visant à adapter l'autorité judiciaire à la lutte contre les violences sexuelles et intrafamiliales (première lecture).", "scrutin public solennel");
  assert.equal(org.nature, "ensemble");
  assert.equal(org.titre, "Vote sur l'ensemble de la proposition de loi organique");
  // Même forme pour un projet de loi et une résolution (votés d'un bloc).
  assert.equal(v("le projet de loi autorisant l'approbation de l'accord entre le Gouvernement de la République française et la Communauté des Caraïbes relatif à l'adhésion au protocole sur les privilèges et immunités de la Communauté des Caraïbes du 14 janvier 1985 (première lecture).").titre, "Vote sur l'ensemble du projet de loi");
  const res = v("la proposition de résolution demandant la libération des prisonniers arméniens détenus par l'Azerbaïdjan (article 34-1 de la Constitution).");
  assert.equal(res.nature, "ensemble");
  assert.equal(res.titre, "Vote sur l'ensemble de la proposition de résolution");
  assert.deepEqual(res.precisions, ["Article 34-1 de la Constitution"]);
});

test("une partie de loi de finances n'est PAS le texte entier", () => {
  const p = v("la première partie du projet de loi de finances pour 2026 (première lecture).", "scrutin public solennel");
  assert.equal(p.nature, "partie");
  assert.equal(p.titre, "Première partie");
  const e = v("l'ensemble de la deuxième partie du projet de loi de financement de la sécurité sociale pour 2025 (première lecture).");
  assert.equal(e.nature, "partie");
  assert.equal(e.titre, "Vote sur l'ensemble de la deuxième partie");
  assert.equal(v("la deuxième partie projet de loi de financement de la sécurité sociale pour 2026 (nouvelle lecture).").titre, "Deuxième partie");
});

test("motions : rejet préalable (avec ou sans « sur ») et censure", () => {
  const r = v("la motion de rejet préalable, déposée par M. Boris Vallaud, du projet de loi de finances pour 2027 (première lecture).");
  assert.equal(r.nature, "motion");
  assert.equal(r.titre, "Motion de rejet préalable, déposée par M. Boris Vallaud");
  assert.equal(r.texte, "Projet de loi de finances pour 2027");
  assert.equal(v("sur la motion de rejet préalable, déposée par Mme Mathilde Panot, de la proposition de loi visant à protéger les mineurs des risques auxquels les expose l'utilisation des réseaux sociaux (première lecture).").titre, "Motion de rejet préalable, déposée par Mme Mathilde Panot");
  const c = v("la motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par Mme Mathilde Panot et 57 députés.", "motion de censure");
  assert.equal(c.nature, "censure");
  assert.equal(c.etiquette, "Motion de censure");
  assert.equal(c.titre, "Motion de censure, déposée en application de l'article 49, alinéa 2, de la Constitution, par Mme Mathilde Panot et 57 députés");
  assert.equal(c.texte, null);
});

test("procédure : le texte visé entre parenthèses est reconnu", () => {
  const r = v("la proposition du Gouvernement de prolonger la séance en cours au delà de minuit (projet de loi d'urgence pour la protection et la souveraineté agricoles) (texte de la commission mixte paritaire).");
  assert.equal(r.nature, "procedure");
  assert.equal(r.titre, "Proposition du Gouvernement de prolonger la séance en cours au delà de minuit");
  assert.equal(r.texte, "Projet de loi d'urgence pour la protection et la souveraineté agricoles");
  assert.deepEqual(r.precisions, ["Texte de la commission mixte paritaire"]);
  // Une demande de seconde délibération qui cite un amendement reste une procédure.
  const d = v("la demande de seconde délibération de M. Jean-Philippe Tanguy sur l'amendement n° 2 de M. Fabrice Brun et les amendements identiques suivants à l'article 2 de la proposition de loi organique visant à harmoniser le mode de scrutin aux élections municipales afin de garantir la vitalité démocratique, la cohésion municipale et la parité (première lecture).");
  assert.equal(d.nature, "procedure");
  assert.equal(d.titre, "Demande de seconde délibération de M. Jean-Philippe Tanguy sur l'amendement n° 2 de M. Fabrice Brun et les amendements identiques suivants à l'article 2");
  const s = v("la demande de suspension de séance présentée par M. Lachaud (article 58 du Règlement de l'Assemblée nationale).");
  assert.equal(s.titre, "Demande de suspension de séance présentée par M. Lachaud");
  assert.equal(s.texte, null);
  assert.deepEqual(s.precisions, ["Article 58 du Règlement de l'Assemblée nationale"]);
});

test("déclaration du Gouvernement", () => {
  const r = v("la déclaration du Gouvernement portant sur la stratégie de défense nationale (application de l'article 50-1 de la Constitution).", "scrutin public solennel");
  assert.equal(r.nature, "declaration");
  assert.equal(r.titre, "Déclaration du Gouvernement portant sur la stratégie de défense nationale");
  assert.deepEqual(r.precisions, ["Application de l'article 50-1 de la Constitution"]);
});

test("apostrophe typographique et intitulé absent", () => {
  assert.equal(v("l’ensemble de la proposition de loi visant à réduire l’impact environnemental de l’industrie textile (texte de la commission mixte paritaire).").nature, "ensemble");
  const vide = ceQuiEstVote({ titre: null });
  assert.equal(vide.nature, "autre");
  assert.equal(vide.titre, "Scrutin");
});

test("le filtre par type existant est inchangé", () => {
  assert.equal(classerScrutin({ titre: "l'amendement n° 3 à l'article 2 du projet de loi …" }), "amendement");
  assert.equal(classerScrutin({ titre: "l'ensemble de la proposition de loi …" }), "proposition");
});

test("amendement au texte de la CMP : « au » / « à la » ne traînent pas en fin de titre", () => {
  const r = v("l'amendement n° 7 du Gouvernement au projet de loi d'urgence pour la protection et la souveraineté agricoles (texte de la commission mixte paritaire).");
  assert.equal(r.titre, "Amendement n° 7 du Gouvernement");
  assert.equal(r.texte, "Projet de loi d'urgence pour la protection et la souveraineté agricoles");
  assert.deepEqual(r.precisions, ["Texte de la commission mixte paritaire"]);
  assert.equal(
    v("l'amendement n° 1 du Gouvernement à la proposition de loi visant à réduire l'impact environnemental de l'industrie textile (texte de la commission mixte paritaire).").titre,
    "Amendement n° 1 du Gouvernement",
  );
});
