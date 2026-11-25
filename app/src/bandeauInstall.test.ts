import { test } from "node:test";
import assert from "node:assert/strict";
import { bandeauReparu, palierDe } from "./bandeauInstall";

test("paliers : 0 sous 10, puis 10, puis 33", () => {
  assert.equal(palierDe(0), 0);
  assert.equal(palierDe(9), 0);
  assert.equal(palierDe(10), 10);
  assert.equal(palierDe(32), 10);
  assert.equal(palierDe(33), 33);
  assert.equal(palierDe(80), 33);
});

test("bandeau refusé : revient une fois à 10, une fois à 33, plus ensuite", () => {
  // Refus à 3 réponses (palier 0) : rien avant 10.
  assert.equal(bandeauReparu(9, 0), false);
  assert.equal(bandeauReparu(10, 0), true);
  // Refusé de nouveau à 12 (palier 10) : rien avant 33.
  assert.equal(bandeauReparu(20, 10), false);
  assert.equal(bandeauReparu(33, 10), true);
  // Refusé à 33 : plus jamais.
  assert.equal(bandeauReparu(120, 33), false);
  // Refus d'avant la v1.44.0 (palier absent = 0) avec déjà 15 réponses : revient une fois.
  assert.equal(bandeauReparu(15, 0), true);
});
