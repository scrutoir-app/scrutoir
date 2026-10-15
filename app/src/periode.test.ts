import { test } from "node:test";
import assert from "node:assert/strict";
import { bornePeriode } from "./periode";

test("bornePeriode : même jour 6 ou 12 mois plus tôt, « all » sans borne", () => {
  assert.equal(bornePeriode("all", "2026-10-15"), null);
  assert.equal(bornePeriode("6m", "2026-10-15"), "2026-04-15");
  assert.equal(bornePeriode("12m", "2026-10-15"), "2025-10-15");
  assert.equal(bornePeriode("6m", "2026-03-15"), "2025-09-15"); // changement d'année
  assert.equal(bornePeriode("6m", "2026-07-02"), "2026-01-02");
});

test("bornePeriode : en fin de mois, le jour est borné au dernier jour du mois visé", () => {
  assert.equal(bornePeriode("6m", "2026-08-31"), "2026-02-28"); // setMonth donnait le 3 mars
  assert.equal(bornePeriode("6m", "2026-08-29"), "2026-02-28");
  assert.equal(bornePeriode("6m", "2026-10-31"), "2026-04-30"); // setMonth donnait le 1er mai
  assert.equal(bornePeriode("12m", "2028-02-29"), "2027-02-28"); // 29 février d'une année bissextile
  assert.equal(bornePeriode("6m", "2028-08-31"), "2028-02-29"); // février bissextile visé
  assert.equal(bornePeriode("6m", "2026-12-31"), "2026-06-30");
});
