import { test } from "node:test";
import assert from "node:assert/strict";
import { getFollows, isFollowed, suivreSansMesure, toggleFollow } from "./follows";

// Espion sur les deux canaux de sortie de track() (sendBeacon, sinon fetch) : aucun appel
// réseau réel, et on compte ce qui serait parti vers le Worker analytics.
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
});
