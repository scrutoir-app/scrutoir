import { test } from "node:test";
import assert from "node:assert/strict";
import { PERIODES, saisonActive } from "./saisons.mjs";
import { DECORS, SAISON_JS } from "./splash-saison.mjs";

const le = (a, m, j, h = 12, min = 0) => new Date(a, m - 1, j, h, min); // heure locale

test("Halloween : du 17 octobre au 2 novembre inclus, chaque année", () => {
  assert.equal(saisonActive(le(2026, 10, 16), PERIODES), null);
  assert.equal(saisonActive(le(2026, 10, 17), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 10, 31), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 2), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 3), PERIODES), null);
  assert.equal(saisonActive(le(2027, 10, 28), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 6, 15), PERIODES), null);
});

test("Fêtes : neige du 19 au 31 décembre, Minuit du 1er au 5 janvier inclus", () => {
  assert.equal(saisonActive(le(2026, 12, 18, 23, 59), PERIODES), null);
  assert.equal(saisonActive(le(2026, 12, 19, 0, 0), PERIODES), "neige");
  assert.equal(saisonActive(le(2026, 12, 25), PERIODES), "neige");
  assert.equal(saisonActive(le(2026, 12, 31, 23, 59), PERIODES), "neige");
  assert.equal(saisonActive(le(2027, 1, 1, 0, 0), PERIODES), "minuit");
  assert.equal(saisonActive(le(2027, 1, 5, 23, 59), PERIODES), "minuit");
  assert.equal(saisonActive(le(2027, 1, 6, 0, 0), PERIODES), null);
});

test("chaque période a un décor, et aucun jour n'appartient à deux périodes", () => {
  for (const p of PERIODES) assert.ok(DECORS.includes(p.id), p.id);
  for (let j = new Date(2028, 0, 1, 12); j.getFullYear() === 2028; j.setDate(j.getDate() + 1)) {
    const n = PERIODES.filter((p) => saisonActive(j, [p])).length;
    assert.ok(n <= 1, j.toDateString());
  }
});

test("Neige et Minuit forcent le splash sombre (illisibles sur fond clair), pas Halloween", () => {
  const debut = SAISON_JS.indexOf("var DECORS=") + "var DECORS=".length;
  const D = new Function(`return ${SAISON_JS.slice(debut, SAISON_JS.indexOf("\n        };", debut) + 10)}`)();
  assert.deepEqual(Object.keys(D).sort(), [...DECORS].sort());
  assert.equal(D.neige.sombre, 1);
  assert.equal(D.minuit.sombre, 1);
  assert.equal(D.halloween.sombre, undefined);
});

test("le script de la surcouche généré au build est du JS valide", () => {
  assert.doesNotThrow(() => new Function(SAISON_JS));
});

test("bornes à minuit, heure locale de l'utilisateur", () => {
  assert.equal(saisonActive(le(2026, 10, 17, 0, 0), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 2, 23, 59), PERIODES), "halloween");
  assert.equal(saisonActive(le(2026, 11, 3, 0, 0), PERIODES), null);
  assert.equal(saisonActive(le(2026, 10, 16, 23, 59), PERIODES), null);
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
  assert.equal(inline(le(2026, 11, 3), PERIODES), null);
});
