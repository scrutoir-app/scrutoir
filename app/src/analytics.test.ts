import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYTICS_PROD, CLE_MESURE, abonnerMesure, endpointAnalytics, hoteLocal, mesureActive, reglerMesure, track,
} from "./analytics";

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

// --- Trafic interne et opposition (v1.43.0) ---

const memoire = new Map<string, string>();
const stockage = {
  getItem: (k: string) => (memoire.has(k) ? memoire.get(k)! : null),
  setItem: (k: string, v: string) => void memoire.set(k, String(v)),
  removeItem: (k: string) => void memoire.delete(k),
};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: stockage });

/** Pose un build de production servi depuis `hote`, sans EXPO_PUBLIC_ANALYTICS_URL. */
function enProduction<T>(hote: string, f: () => T): T {
  const env = process.env as Record<string, string | undefined>;
  const avant = env.NODE_ENV;
  delete env.EXPO_PUBLIC_ANALYTICS_URL;
  env.NODE_ENV = "production";
  Object.defineProperty(globalThis, "location", { configurable: true, value: { hostname: hote } });
  try {
    return f();
  } finally {
    if (avant === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = avant;
    delete (globalThis as { location?: unknown }).location;
  }
}

test("page servie en local : jamais le Worker de prod, même dans un build de production", () => {
  for (const h of ["localhost", "127.0.0.1", "127.0.1.1", "::1", "[::1]", "app.localhost", "0.0.0.0"]) {
    assert.equal(endpointAnalytics(undefined, "production", h), "", h);
    assert.equal(endpointAnalytics(ANALYTICS_PROD, "production", h), "", `${h} (URL explicite)`);
  }
  assert.equal(endpointAnalytics(undefined, "production", "scrutoir.fr"), ANALYTICS_PROD);
  // La voie de test locale (Worker local) reste ouverte.
  assert.equal(endpointAnalytics("http://127.0.0.1:8787/collect", "production", "localhost"), "http://127.0.0.1:8787/collect");
  assert.equal(hoteLocal("scrutoir.fr"), false);
  assert.equal(hoteLocal(undefined), false);
});

test("track() dans un build de production servi sur localhost : aucun envoi", () => {
  memoire.clear();
  envois.length = 0;
  enProduction("localhost", () => track("screen", "search"));
  assert.equal(envois.length, 0);
  enProduction("127.0.0.1", () => track("screen", "search"));
  assert.equal(envois.length, 0);
  // Témoin : le même build en ligne mesure, vers la prod.
  enProduction("scrutoir.fr", () => track("screen", "search"));
  assert.equal(envois.length, 1);
  assert.equal(envois[0].url, ANALYTICS_PROD);
});

test("scrutoir.mesure = off : track() n'envoie rien ; on (ou absent) : envoi", () => {
  process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";
  try {
    memoire.clear();
    envois.length = 0;
    assert.equal(mesureActive(), true, "active par défaut");
    reglerMesure(false);
    assert.equal(memoire.get(CLE_MESURE), "off");
    track("screen", "search");
    track("share", "spectre_story", "shared");
    assert.equal(envois.length, 0);
    reglerMesure(true);
    assert.equal(memoire.get(CLE_MESURE), "on");
    track("screen", "search");
    assert.equal(envois.length, 1);
  } finally {
    delete process.env.EXPO_PUBLIC_ANALYTICS_URL;
    memoire.clear();
  }
});

test("stockage illisible : le réglage tient en mémoire, la lecture ne lève jamais", () => {
  const casse = {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("QuotaExceeded"); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: casse });
  process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";
  try {
    envois.length = 0;
    reglerMesure(false);
    assert.equal(mesureActive(), false);
    track("screen", "search");
    assert.equal(envois.length, 0);
    reglerMesure(true);
    assert.equal(mesureActive(), true);
  } finally {
    delete process.env.EXPO_PUBLIC_ANALYTICS_URL;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: stockage });
  }
});

test("abonnerMesure : prévenu à chaque réglage, désabonnement effectif", () => {
  let n = 0;
  const fin = abonnerMesure(() => n++);
  reglerMesure(false);
  reglerMesure(true);
  fin();
  reglerMesure(false);
  assert.equal(n, 2);
  reglerMesure(true);
  memoire.clear();
});
