import { test } from "node:test";
import assert from "node:assert/strict";
import { partagerLien, urlDepute, urlParti, urlRubrique, urlScrutin } from "./share";
import { partagerImage } from "./share/storyImage";
import { urlPartage } from "./testProximite/storage";

// Espion sur la sortie de track() ; une URL posée pour que la mesure parte.
const envois: { t: string; e: string; x: string }[] = [];
Object.defineProperty(globalThis.navigator ?? globalThis, "sendBeacon", {
  configurable: true,
  value: (_url: string, body: string) => { envois.push(JSON.parse(body)); return true; },
});
process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";

/** Pose share / canShare / clipboard sur navigator, le temps d'un test. */
function navigateur(o: { share?: (d: unknown) => Promise<void>; canShare?: (d: unknown) => boolean; clipboard?: { writeText: (s: string) => Promise<void> } }) {
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  for (const k of ["share", "canShare", "clipboard"] as const) {
    Object.defineProperty(nav, k, { configurable: true, value: o[k] });
  }
}
const abort = () => Object.assign(new Error("fermé"), { name: "AbortError" });
const mesures = () => envois.filter((e) => e.t === "share").map((e) => [e.e, e.x]);

test("partagerLien : feuille système → shared, un événement share", async () => {
  envois.length = 0;
  navigateur({ share: async () => {} });
  assert.equal(await partagerLien("scrutin", "https://scrutoir.fr/?open=scrutin:S1", "texte"), "shared");
  assert.deepEqual(mesures(), [["scrutin", "shared"]]);
});

test("partagerLien : feuille fermée (AbortError) → cancelled, pas « manual »", async () => {
  envois.length = 0;
  navigateur({ share: async () => { throw abort(); }, clipboard: { writeText: async () => {} } });
  assert.equal(await partagerLien("test_lien", "u", "t"), "cancelled");
  assert.deepEqual(mesures(), [["test_lien", "cancelled"]]);
});

test("partagerLien : sans feuille → copie ; sans rien → manual ; autre erreur → manual", async () => {
  envois.length = 0;
  let copie = "";
  navigateur({ clipboard: { writeText: async (s) => void (copie = s) } });
  assert.equal(await partagerLien("depute", "https://x/", "Texte"), "copied");
  assert.equal(copie, "Texte\nhttps://x/");
  navigateur({});
  assert.equal(await partagerLien("parti", "u", "t"), "manual");
  navigateur({ share: async () => { throw Object.assign(new Error("geste expiré"), { name: "NotAllowedError" }); } });
  assert.equal(await partagerLien("mesure", "u", "t"), "manual");
  assert.deepEqual(mesures(), [["depute", "copied"], ["parti", "manual"], ["mesure", "manual"]]);
});

test("partagerImage : partagée, fermée, téléchargée, impossible — un événement à chaque fois", async () => {
  envois.length = 0;
  const blob = new Blob(["png"], { type: "image/png" });
  navigateur({ canShare: () => true, share: async () => {} });
  assert.equal(await partagerImage("spectre_story", blob), "shared");
  navigateur({ canShare: () => true, share: async () => { throw abort(); } });
  assert.equal(await partagerImage("spectre_story", blob), "cancelled");

  // Sans partage de fichiers : téléchargement par un lien <a download>.
  navigateur({});
  let clics = 0;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => ({ click: () => void clics++, remove: () => {} }), body: { appendChild: () => {} } },
  });
  try {
    assert.equal(await partagerImage("spectre_story", blob), "downloaded");
    assert.equal(clics, 1);
  } finally {
    delete (globalThis as { document?: unknown }).document;
  }
  assert.equal(await partagerImage("spectre_story", blob), "manual");
  assert.deepEqual(mesures(), [
    ["spectre_story", "shared"],
    ["spectre_story", "cancelled"],
    ["spectre_story", "downloaded"],
    ["spectre_story", "manual"],
  ]);
});

test("partage : jamais le contenu partagé dans la mesure", async () => {
  envois.length = 0;
  navigateur({ share: async () => {} });
  await partagerLien("test_lien", "https://scrutoir.fr/?via=partage#test=eyJyIjp7IjEiOjF9fQ", "Voici mon résultat : proche du groupe X à 80 %");
  const corps = JSON.stringify(envois);
  assert.doesNotMatch(corps, /test=|eyJ|proche|80/);
});

test("liens partagés : marqués via=partage, anciens paramètres intacts", () => {
  assert.equal(urlScrutin("VTANR5L17V1"), "https://scrutoir.fr/?open=scrutin:VTANR5L17V1&via=partage");
  assert.equal(urlDepute("PA1"), "https://scrutoir.fr/?open=depute:PA1&via=partage");
  assert.equal(urlParti("PO1"), "https://scrutoir.fr/?open=parti:PO1&via=partage");
  assert.equal(urlRubrique({ ecran: "presidentielle" }), "https://scrutoir.fr/?open=presidentielle&via=partage");
  assert.match(urlPartage({ 1: "pour" }), /^https:\/\/scrutoir\.fr\/\?via=partage#test=[\w-]+$/);
});
