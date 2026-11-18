import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { EVENTS, normaliser, traiterCollecte } from "./collecte";
import { ENTREES, ISSUES_PARTAGE, QUOI_PARTAGE, SOURCES } from "../../app/src/mesureListes";

const ORIGINES = ["https://scrutoir.fr"];

async function poster(corps: unknown, origin: string | null = "https://scrutoir.fr") {
  const ecrits: { blobs: string[] }[] = [];
  const headers: Record<string, string> = { "Content-Type": "text/plain" };
  if (origin) headers.Origin = origin;
  const res = await traiterCollecte(
    new Request("https://w.test/collect", { method: "POST", headers, body: typeof corps === "string" ? corps : JSON.stringify(corps) }),
    { writeDataPoint: (p) => void ecrits.push(p) },
    ORIGINES,
  );
  return { res, ecrits };
}

test("share et arrivee : valeurs des listes fermées gardées telles quelles", () => {
  for (const quoi of QUOI_PARTAGE) for (const issue of ISSUES_PARTAGE) {
    assert.deepEqual(normaliser({ t: "share", e: quoi, x: issue, d: "mobile" }), { type: "share", e: quoi, x: issue, d: "mobile" });
  }
  for (const entree of ENTREES) for (const source of SOURCES) {
    assert.deepEqual(normaliser({ t: "arrivee", e: entree, x: source, d: "" }), { type: "arrivee", e: entree, x: source, d: "" });
  }
});

test("share et arrivee : une valeur hors liste devient « autre », jamais stockée telle quelle", async () => {
  const { res, ecrits } = await poster({ t: "arrivee", e: "https://exemple.org/page?mail=a@b.c", x: "newsletter", d: "mobile" });
  assert.equal(res.status, 204);
  assert.deepEqual(ecrits[0].blobs, ["arrivee", "autre", "autre", "mobile"]);
  assert.deepEqual(normaliser({ t: "share", e: "proche du groupe X", x: "ok" }), { type: "share", e: "autre", x: "autre", d: "" });
});

test("type inconnu : refusé, rien n'est écrit (réponse 204 quand même)", async () => {
  const { res, ecrits } = await poster({ t: "reponse_test", e: "pour", x: "" });
  assert.equal(res.status, 204);
  assert.equal(ecrits.length, 0);
  assert.equal(normaliser({ t: "" }), null);
  assert.equal(normaliser(null), null);
});

test("origine étrangère ou locale : rien n'est écrit", async () => {
  for (const o of ["http://localhost:8099", "http://localhost:8081", "https://autre.site", null]) {
    const { res, ecrits } = await poster({ t: "screen", e: "search" }, o);
    assert.equal(res.status, 204);
    assert.equal(ecrits.length, 0, String(o));
  }
});

test("corps invalide : ignoré, pas d'exception", async () => {
  const { res, ecrits } = await poster("{pas du json");
  assert.equal(res.status, 204);
  assert.equal(ecrits.length, 0);
});

test("classe d'appareil : liste fermée, sinon vide ; types existants inchangés", async () => {
  const { ecrits } = await poster({ t: "depute", e: "PA1", x: "affinite", d: "frigo" });
  assert.deepEqual(ecrits[0].blobs, ["depute", "PA1", "affinite", ""]);
});

test("wrangler.toml : aucune origine locale autorisée", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const ligne = toml.split("\n").find((l) => l.startsWith("ALLOWED_ORIGINS"))!;
  assert.doesNotMatch(ligne, /localhost|127\.0\.0\.1/);
  assert.match(ligne, /https:\/\/scrutoir\.fr/);
});

test("chaque track(\"<type>\") de l'app est accepté par le Worker (sinon rejeté sans bruit)", () => {
  const app = new URL("../../app/", import.meta.url).pathname;
  let sortie = "";
  try {
    sortie = execFileSync("grep", ["-rhoE", 'track\\(\\s*"[a-z_]+"', `${app}src`, `${app}App.tsx`, "--include=*.ts", "--include=*.tsx"], { encoding: "utf8" });
  } catch {
    sortie = "";
  }
  const types = new Set([...sortie.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
  // follows.ts émet par une variable (basculer) : follow, unfollow, follow_parti, unfollow_parti.
  for (const t of ["follow", "unfollow", "follow_parti", "unfollow_parti"]) types.add(t);
  assert.ok(types.size > 10, "le relevé doit trouver les appels");
  for (const t of types) assert.ok(EVENTS.has(t), `type « ${t} » émis par l'app mais refusé par le Worker`);
});
