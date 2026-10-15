import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_PROD, endpointAnalytics, track } from "./analytics";

// Espion sur les deux canaux de sortie de track() (sendBeacon, sinon fetch).
const envois: { url: string; body: string }[] = [];
globalThis.fetch = (async (url: unknown, init?: { body?: unknown }) => {
  envois.push({ url: String(url), body: String(init?.body ?? "") });
  return new Response(null);
}) as typeof fetch;
Object.defineProperty(globalThis.navigator ?? globalThis, "sendBeacon", {
  configurable: true,
  value: (url: string, body: string) => { envois.push({ url, body }); return true; },
});

test("build de production sans variable : le Worker de prod", () => {
  assert.equal(endpointAnalytics(undefined, "production"), ANALYTICS_PROD);
});

test("dev ou test sans variable : mesure coupée (rien ne part vers la prod)", () => {
  assert.equal(endpointAnalytics(undefined, "development"), "");
  assert.equal(endpointAnalytics(undefined, "test"), "");
  assert.equal(endpointAnalytics(undefined, undefined), "");
});

test("EXPO_PUBLIC_ANALYTICS_URL l'emporte, en dev comme en prod", () => {
  assert.equal(endpointAnalytics("http://127.0.0.1:9/collect", "development"), "http://127.0.0.1:9/collect");
  assert.equal(endpointAnalytics(" https://autre.test/collect ", "production"), "https://autre.test/collect");
});

test("vide ou « off » : mesure coupée, même dans un build de production", () => {
  assert.equal(endpointAnalytics("", "production"), "");
  assert.equal(endpointAnalytics("off", "production"), "");
  assert.equal(endpointAnalytics(" off ", "production"), "");
});

test("track() hors production et sans variable : aucun envoi", () => {
  const env = process.env as Record<string, string | undefined>;
  delete env.EXPO_PUBLIC_ANALYTICS_URL;
  const avant = env.NODE_ENV;
  env.NODE_ENV = "development";
  try {
    envois.length = 0;
    track("screen", "search");
    assert.equal(envois.length, 0);
  } finally {
    if (avant === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = avant;
  }
});

// Témoin : avec une URL posée, le même appel part bien (l'espion n'est pas vacant).
test("track() avec une URL posée : un envoi, vers cette URL", () => {
  process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";
  try {
    envois.length = 0;
    track("screen", "search");
    assert.equal(envois.length, 1);
    assert.equal(envois[0].url, "https://espion.test/collect");
    assert.match(envois[0].body, /"t":"screen"/);
  } finally {
    delete process.env.EXPO_PUBLIC_ANALYTICS_URL;
  }
});
