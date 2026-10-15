import { test } from "node:test";
import assert from "node:assert/strict";
import {
  API_GEO,
  PHRASE_ENVOI,
  PHRASE_ENVOI_SAISIE,
  arrondirCoord,
  urlCommunesSaisie,
  urlCommuneParCoord,
  rangCirco,
  libelleCirco,
  phraseCircos,
  baseAffinite,
  pctAffinite,
  libelleVoteCompare,
  communesValides,
} from "./trouverDepute";

const params = (url: string) => new URL(url).searchParams;

test("Me localiser : n'envoie que la latitude et la longitude arrondies (plus les champs demandés)", () => {
  const url = urlCommuneParCoord(42.96542187, 1.60751234);
  assert.ok(url.startsWith(`${API_GEO}?`));
  const p = params(url);
  assert.deepEqual([...p.keys()].sort(), ["fields", "format", "lat", "lon"]);
  assert.equal(p.get("lat"), "42.965");
  assert.equal(p.get("lon"), "1.608");
  assert.equal(p.get("fields"), "nom,code,codeDepartement,codesPostaux");
});

test("arrondi à 3 décimales, négatifs compris (outre-mer)", () => {
  assert.equal(arrondirCoord(-21.11549), -21.115);
  assert.equal(arrondirCoord(55.5361), 55.536);
  assert.equal(arrondirCoord(0), 0);
});

test("saisie : un code postal part en codePostal, un nom en nom, rien d'autre", () => {
  const cp = params(urlCommunesSaisie(" 09000 ")!);
  assert.equal(cp.get("codePostal"), "09000");
  assert.equal(cp.get("nom"), null);
  const nom = params(urlCommunesSaisie("Saint-Girons")!);
  assert.equal(nom.get("nom"), "Saint-Girons");
  assert.equal(nom.get("codePostal"), null);
  assert.deepEqual([...nom.keys()].sort(), ["boost", "fields", "format", "limit", "nom"]);
  assert.equal(urlCommunesSaisie("a"), null);
  assert.equal(urlCommunesSaisie("   "), null);
});

test("la phrase affichée dit ce que les URL envoient, et à qui", () => {
  assert.match(PHRASE_ENVOI, /geo\.api\.gouv\.fr/);
  assert.match(PHRASE_ENVOI, /arrondie à 100 m/);
  assert.match(PHRASE_ENVOI, /ce que tu tapes/);
  assert.match(PHRASE_ENVOI_SAISIE, /geo\.api\.gouv\.fr/);
  assert.doesNotMatch(PHRASE_ENVOI_SAISIE, /position/); // sans « Me localiser », seule la saisie part
  assert.ok(API_GEO.startsWith("https://geo.api.gouv.fr/"));
});

test("circonscriptions : 1re, 2e, version courte, phrase sans prétendre connaître le code postal", () => {
  assert.equal(rangCirco("1"), "1re");
  assert.equal(rangCirco(2), "2e");
  assert.equal(libelleCirco("1"), "1re circonscription");
  assert.equal(libelleCirco("12", true), "12e circ.");
  assert.equal(phraseCircos(2), "Ton département compte 2 circonscriptions. Choisis la tienne.");
  assert.equal(phraseCircos(1), "Ton département compte une seule circonscription.");
});

test("base de la carte d'affinité, accords du singulier au pluriel", () => {
  assert.equal(baseAffinite(5, 7), "5 votes sur 7 comparés");
  assert.equal(baseAffinite(1, 1), "1 vote sur 1 comparé");
  assert.equal(baseAffinite(0, 3), "0 vote sur 3 comparés");
});

test("pas de pourcentage sous 5 votes comparés (règle du résultat du test)", () => {
  assert.equal(pctAffinite(5 / 7, 7), 71);
  assert.equal(pctAffinite(0.75, 4), null);
  assert.equal(pctAffinite(1, 5), 100);
  assert.equal(pctAffinite(0.6, 3, 3), 60);
});

test("désaccord : « son vote », jamais « lui » (vrai pour une députée)", () => {
  assert.equal(libelleVoteCompare("pour", "contre"), "Toi : Pour · son vote : Contre");
  assert.equal(libelleVoteCompare("contre", "pour"), "Toi : Contre · son vote : Pour");
  assert.equal(libelleVoteCompare("pour", "pour"), "Vous deux : Pour");
  assert.ok(!libelleVoteCompare("pour", "contre").includes("lui"));
});

test("réponse de l'API Géo : seules les communes bien formées passent", () => {
  const ok = { nom: "Foix", code: "09122", codeDepartement: "09", codesPostaux: ["09000"], _score: 0.9 };
  assert.deepEqual(communesValides([ok]), [{ nom: "Foix", code: "09122", codeDepartement: "09", codesPostaux: ["09000"] }]);
  assert.deepEqual(communesValides([{ nom: "Foix", code: "09122", codeDepartement: "09" }]), [{ nom: "Foix", code: "09122", codeDepartement: "09" }]);
  // Entrées mal formées ignorées, une à une ; codes postaux non textuels écartés.
  assert.deepEqual(
    communesValides([null, 42, "Foix", { nom: "Sans code" }, { nom: 1, code: "1", codeDepartement: "01" }, { ...ok, codesPostaux: ["09000", 9000, null] }]),
    [{ nom: "Foix", code: "09122", codeDepartement: "09", codesPostaux: ["09000"] }],
  );
});

test("réponse de l'API Géo inattendue (objet d'erreur, texte, null) : liste vide, l'écran ne casse pas", () => {
  assert.deepEqual(communesValides({ code: 400, message: "Bad Request" }), []);
  assert.deepEqual(communesValides("<html>"), []);
  assert.deepEqual(communesValides(null), []);
  assert.deepEqual(communesValides(undefined), []);
});
