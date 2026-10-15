import { test } from "node:test";
import assert from "node:assert/strict";
import { getFollows, isFollowed, suivreSansMesure, toggleFollow, toggleFollowSansUid } from "./follows";

// Espion sur les deux canaux de sortie de track() (sendBeacon, sinon fetch) : aucun appel
// réseau réel, et on compte ce qui serait parti vers le Worker analytics. Hors build de
// production, la mesure est coupée par défaut (`endpointAnalytics`) : on lui donne une URL.
process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";
const envois: string[] = [];
globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
  envois.push(String(init?.body ?? ""));
  return new Response(null);
}) as typeof fetch;
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (_url: string, body: string) => { envois.push(body); return true; },
  });
}

test("suivi automatique (groupe déduit du test) : suivi posé, AUCUN envoi analytics", () => {
  envois.length = 0;
  suivreSansMesure("PO800001");
  assert.ok(isFollowed("PO800001"));
  assert.equal(envois.length, 0);
});

test("suivi automatique : idempotent, ne retire jamais un suivi existant", () => {
  envois.length = 0;
  suivreSansMesure("PO800001");
  suivreSansMesure("PO800001");
  assert.deepEqual(getFollows().filter((u) => u === "PO800001"), ["PO800001"]);
  assert.equal(envois.length, 0);
});

test("suivi automatique : uid vide ignoré", () => {
  const avant = getFollows();
  suivreSansMesure("");
  assert.deepEqual(getFollows(), avant);
});

// Témoin : le geste explicite (toggleFollow) reste mesuré — prouve que l'espion capte bien
// les envois et que le 0 ci-dessus n'est pas vacant.
test("suivi au geste de l'utilisateur : toujours mesuré (témoin de l'espion)", () => {
  envois.length = 0;
  toggleFollow("PO800002");
  assert.ok(isFollowed("PO800002"));
  assert.equal(envois.length, 1);
  assert.match(envois[0], /"t":"follow_parti"/);
  assert.match(envois[0], /"e":"PO800002"/); // les autres écrans gardent l'uid
});

// Cloche du spectre sur l'écran de résultat du test (E2) : le geste est compté, mais l'envoi
// ne dit pas quel groupe (pas d'uid, contexte « test »), à la pose comme au retrait.
test("cloche du résultat du test : suivi posé, mesuré SANS uid", () => {
  envois.length = 0;
  toggleFollowSansUid("PO800003");
  assert.ok(isFollowed("PO800003"));
  assert.equal(envois.length, 1);
  const e = JSON.parse(envois[0]);
  assert.equal(e.t, "follow_parti");
  assert.equal(e.e, "");
  assert.equal(e.x, "test");
  assert.ok(!envois[0].includes("PO800003"));
});

test("cloche du résultat du test : retrait, même règle (sans uid)", () => {
  envois.length = 0;
  toggleFollowSansUid("PO800003");
  assert.ok(!isFollowed("PO800003"));
  assert.equal(envois.length, 1);
  const e = JSON.parse(envois[0]);
  assert.equal(e.t, "unfollow_parti");
  assert.equal(e.e, "");
  assert.ok(!envois[0].includes("PO800003"));
});

test("cloche du résultat du test : uid vide ignoré, rien n'est envoyé", () => {
  envois.length = 0;
  const avant = getFollows();
  toggleFollowSansUid("");
  assert.deepEqual(getFollows(), avant);
  assert.equal(envois.length, 0);
});

// Deck d'affinité (Trouver ton député) : on suit après avoir vu « N % comme toi ». Geste compté
// sans uid, contexte « affinite », à la pose comme à l'annulation.
test("deck d'affinité : suivre puis annuler, mesuré SANS uid (contexte affinite)", () => {
  envois.length = 0;
  toggleFollowSansUid("PA700001", "affinite");
  assert.ok(isFollowed("PA700001"));
  toggleFollowSansUid("PA700001", "affinite");
  assert.ok(!isFollowed("PA700001"));
  assert.equal(envois.length, 2);
  const [pose, retrait] = envois.map((b) => JSON.parse(b));
  assert.deepEqual([pose.t, pose.e, pose.x], ["follow", "", "affinite"]);
  assert.deepEqual([retrait.t, retrait.e, retrait.x], ["unfollow", "", "affinite"]);
  assert.ok(!envois.join("").includes("PA700001"));
});
