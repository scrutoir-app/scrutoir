import { test } from "node:test";
import assert from "node:assert/strict";
import { PERIODES, saisonActive } from "./saisons.mjs";

const le = (a, m, j, h = 12, min = 0) => new Date(a, m - 1, j, h, min); // heure locale

test("Halloween : du 26 au 31 octobre inclus, chaque année", () => {
  assert.equal(saisonActive(le(2026, 10, 25), PERIODES), null);
  assert.equal(saisonActive(le(2026, 10, 26), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 10, 31), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 1), PERIODES), null); // Toussaint : pas de décor
  assert.equal(saisonActive(le(2027, 10, 28), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 6, 15), PERIODES), null);
});

test("bornes à minuit, heure locale de l'utilisateur", () => {
  assert.equal(saisonActive(le(2026, 10, 26, 0, 0), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 10, 31, 23, 59), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 1, 0, 0), PERIODES), null);
  assert.equal(saisonActive(le(2026, 10, 25, 23, 59), PERIODES), null);
});

test("période à cheval sur le 1er janvier", () => {
  const p = [{ id: "fetes", debut: "12-20", fin: "01-02" }];
  assert.equal(saisonActive(le(2026, 12, 19), p), null);
  assert.equal(saisonActive(le(2026, 12, 20), p), "fetes");
  assert.equal(saisonActive(le(2026, 12, 31), p), "fetes");
  assert.equal(saisonActive(le(2027, 1, 2), p), "fetes");
  assert.equal(saisonActive(le(2027, 1, 3), p), null);
});

test("première période qui correspond, sinon null", () => {
  const p = [{ id: "a", debut: "03-01", fin: "03-10" }, { id: "b", debut: "03-05", fin: "03-20" }];
  assert.equal(saisonActive(le(2026, 3, 6), p), "a");
  assert.equal(saisonActive(le(2026, 3, 15), p), "b");
  assert.equal(saisonActive(le(2026, 3, 6), []), null);
});

test("les périodes configurées sont bien formées (MM-JJ, mois et jour plausibles)", () => {
  for (const p of PERIODES) {
    for (const b of [p.debut, p.fin]) {
      assert.match(b, /^\d\d-\d\d$/, `${p.id} : ${b}`);
      const [m, j] = b.split("-").map(Number);
      assert.ok(m >= 1 && m <= 12 && j >= 1 && j <= 31, `${p.id} : ${b}`);
    }
  }
});

test("saisonActive reste inlinable dans le splash (toString autonome)", () => {
  const inline = new Function(`return ${saisonActive.toString()}`)();
  assert.equal(inline(le(2026, 10, 28), PERIODES), "halloween");
  assert.equal(inline(le(2026, 11, 2), PERIODES), null);
});
