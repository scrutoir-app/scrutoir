import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { versionnerSw } from "./sw-version.mjs";
import { APP_VERSION } from "../src/config.ts";

const swSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const version = (src) => /const SHELL_VERSION = "([^"]+)";/.exec(src)?.[1];

test("sw.js du build porte la version de l'appli : une nouvelle version change le fichier", () => {
  const base = version(swSource);
  assert.match(base, /^v\d+$/);
  const v1 = versionnerSw(swSource, "1.35.1");
  const v2 = versionnerSw(swSource, "1.36.0");
  assert.equal(version(v1), `${base}-1.35.1`);
  assert.notEqual(v1, v2); // le navigateur voit un nouveau SW, donc le bandeau s'affiche
  assert.equal(versionnerSw(swSource, APP_VERSION).includes(`"${base}-${APP_VERSION}"`), true);
  // Seule la déclaration change.
  assert.equal(v1.replace(`"${base}-1.35.1"`, `"${base}"`), swSource);
});

test("versionnage idempotent : relancer le build ne double pas le suffixe", () => {
  const v1 = versionnerSw(swSource, "1.35.1");
  assert.equal(versionnerSw(v1, "1.35.1"), v1);
  assert.equal(version(versionnerSw(v1, "1.36.0")), version(versionnerSw(swSource, "1.36.0")));
});

test("versionnage refusé : déclaration introuvable ou version invalide (le build échoue)", () => {
  assert.throws(() => versionnerSw("const AUTRE = 1;", "1.35.1"));
  assert.throws(() => versionnerSw(swSource + '\nconst SHELL_VERSION = "v1";', "1.35.1"));
  assert.throws(() => versionnerSw(swSource, ""));
  assert.throws(() => versionnerSw(swSource, "1.35"));
});
