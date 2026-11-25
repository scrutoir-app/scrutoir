import { test } from "node:test";
import assert from "node:assert/strict";
import { assembler, compter, fenetres, RETENTION_JOURS, type Brut, type Noms } from "./donnees";
import { rendreTableau } from "./tableau";

const JOUR = 86_400_000;
const MAINTENANT = Date.parse("2026-12-03T14:00:00Z");
const DEBUT = Date.parse("2026-11-19T10:00:00Z");
const noms: Noms = { depute: new Map([["PA1", "Camille Martin"]]), scrutin: new Map(), theme: new Map(), parti: new Map() };

test("fenêtres : comptes depuis la première visite mesurée, écarts n/d avant la mesure ou hors rétention", () => {
  const f7 = fenetres(MAINTENANT, 7, DEBUT);
  assert.equal(f7.debutCompte, MAINTENANT - 7 * JOUR);
  assert.equal(f7.precedentComparable, true);
  const f30 = fenetres(MAINTENANT, 30, DEBUT);
  assert.equal(f30.debutCompte, DEBUT);
  assert.equal(f30.precedentComparable, false);
  assert.match(f30.raisonND, /avant le début de la mesure/);
  const f90 = fenetres(DEBUT + 200 * JOUR, 90, DEBUT);
  assert.ok(2 * 90 > RETENTION_JOURS);
  assert.equal(f90.precedentComparable, false);
  assert.match(f90.raisonND, /trois mois/);
  const rien = fenetres(MAINTENANT, 7, null);
  assert.equal(rien.precedentComparable, false);
  assert.match(rien.raisonND, /aucune visite/);
});

test("compter : visites, Instagram, partages réussis et résultats partagés", () => {
  const c = compter([
    { t: "arrivee", e: "accueil", x: "insta_bio", n: 10 },
    { t: "arrivee", e: "accueil", x: "instagram", n: 2 },
    { t: "arrivee", e: "test", x: "partage", n: 4 },
    { t: "arrivee", e: "scrutin", x: "partage", n: 3 },
    { t: "arrivee", e: "accueil", x: "direct", n: 5 },
    { t: "test_start", e: "complet", x: "", n: 20 },
    { t: "test_done", e: "complet", x: "", n: 12 },
    { t: "share", e: "spectre_story", x: "shared", n: 3 },
    { t: "share", e: "spectre_story", x: "cancelled", n: 7 },
    { t: "share", e: "test_lien", x: "copied", n: 1 },
    { t: "share", e: "scrutin", x: "shared", n: 2 },
    { t: "share", e: "spectre_story", x: "downloaded", n: 1 },
  ]);
  assert.deepEqual(c, {
    visites: 24, visitesInstagram: 12, visitesPartage: 7, visitesPartageTest: 4,
    testsCommences: 20, testsTermines: 12, partagesReussis: 7, partagesSpectre: 5,
  });
});

function brut(over: Partial<Brut> = {}): Brut {
  return {
    jours: 30,
    maintenant: MAINTENANT,
    debutMesure: DEBUT,
    ...fenetres(MAINTENANT, 30, DEBUT),
    courant: [{ t: "arrivee", e: "accueil", x: "insta_bio", n: 5 }, { t: "test_done", e: "complet", x: "", n: 2 }],
    precedent: [],
    activite: [{ d: "2026-12-02 00:00:00", t: "arrivee", n: 5 }, { d: "2026-12-02 00:00:00", t: "test_done", n: 2 }],
    parType: [{ k: "screen", n: 40 }, { k: "arrivee", n: 5 }, { k: "nouveau_type", n: 3 }, { k: "install", n: 1 }],
    appareils: [{ k: "mobile", n: 30 }, { k: "desktop", n: 15 }],
    tops: { search: [{ k: `<img src=x onerror="alert(1)">`, n: 4 }], depute: [{ k: "PA1", n: 9 }, { k: "", n: 1 }] },
    ...over,
  };
}

test("assembler : un point par jour, autres types visibles d'office, noms résolus", () => {
  const d = assembler(brut(), noms);
  assert.equal(d.activite.length, 30);
  assert.deepEqual(d.activite.find((p) => p.jour === "2026-12-02"), { jour: "2026-12-02", visites: 5, tests: 2 });
  assert.deepEqual(d.autres.map((a) => a.type), ["nouveau_type", "install"]);
  assert.equal(d.precedent, null);
  assert.equal(d.provenance.insta_bio, 5);
  const deputes = d.classements.find((c) => c.id === "deputes")!;
  assert.deepEqual(deputes.lignes.map((l) => l.libelle), ["Camille Martin", "(non précisé)"]);
  assert.equal(d.totalEvenements, 49);
});

test("rendu : aucun script, entrées échappées, n/d expliqué, onglets en CSS", () => {
  const html = rendreTableau(assembler(brut(), noms), [{ date: "2026-11-19", libelle: "Mesure des partages" }]);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /n\/d/);
  assert.match(html, /Mesure des partages/);
  assert.match(html, /Visites et partages mesurés depuis le 19 nov\./);
  const onglets = html.match(/<input type="radio" name="cl"/g) ?? [];
  assert.equal(onglets.length, 14, "13 classements + Autres");
  assert.match(html, /nouveau_type/);
  for (const titre of ["Visites", "Tests terminés", "Partages réussis", "Visites via un partage", "Entonnoir du test", "Provenance des visites", "Classements"]) {
    assert.ok(html.includes(titre), titre);
  }
});

test("rendu : écart affiché quand la période précédente est comparable", () => {
  const f = fenetres(MAINTENANT, 7, DEBUT);
  const d = assembler(brut({ jours: 7, ...f, precedent: [{ t: "arrivee", e: "accueil", x: "direct", n: 4 }] }), noms);
  assert.equal(d.precedent?.visites, 4);
  assert.match(rendreTableau(d, []), /↑ 25 %/);
});

test("onglets Contextes et Installation : visites et tests terminés par contexte, gestes", async () => {
  const { classementsInstall } = await import("./donnees");
  const [ctx, inst] = classementsInstall([
    { t: "contexte", e: "integre-ios", x: "insta_bio", n: 40 },
    { t: "contexte", e: "ios", x: "insta_bio", n: 20 },
    { t: "test_done", e: "complet", x: "integre-ios", n: 4 },
    { t: "test_done", e: "complet", x: "ios", n: 6 },
    { t: "test_done", e: "complet", x: "", n: 9 }, // avant la v1.44.0 : sans contexte, ignoré ici
    { t: "transfert_copie", e: "resultat", x: "copied", n: 3 },
    { t: "transfert_copie", e: "resultat", x: "manual", n: 1 },
    { t: "transfert_colle", e: "presse_papiers", x: "transfert", n: 2 },
    { t: "transfert_colle", e: "presse_papiers", x: "rien", n: 1 },
  ]);
  assert.equal(ctx.id, "contextes");
  assert.deepEqual(ctx.lignes.map((l) => [l.libelle, l.n]), [["Appli intégrée · iPhone", 40], ["iPhone · navigateur", 20]]);
  assert.match(ctx.lignes[0].detail!, /4 tests terminés \(10 %\)/);
  assert.match(ctx.lignes[1].detail!, /6 tests terminés \(30 %\)/);
  assert.deepEqual(inst.lignes.map((l) => [l.libelle, l.n]), [["Réponses copiées", 3], ["Réponses collées dans l'app", 2]]);
  assert.match(inst.lignes[1].detail!, /rien de Scrutoir : 1/);
});
