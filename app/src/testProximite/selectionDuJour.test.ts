import test from "node:test";
import assert from "node:assert/strict";
import { alea, melanger, tirerLot, jourCourant, TAILLE_LOT } from "./selectionDuJour";

/** Vivier factice : 60 députés d'affinité 1 % à 60 % (le tirage n'utilise que uid + pct). */
const vivier = (n = 60) =>
  Array.from({ length: n }, (_, i) => ({
    resume: { uid: `d${i}` },
    score: { pct: (i + 1) / 100 },
  }));

test("le tirage du jour est reproductible (même graine → même lot)", () => {
  const a = tirerLot(vivier(), TAILLE_LOT, alea("2026-08-20")).map((d) => d.resume.uid);
  const b = tirerLot(vivier(), TAILLE_LOT, alea("2026-08-20")).map((d) => d.resume.uid);
  assert.deepEqual(a, b);
});

test("un autre jour donne un autre lot", () => {
  const a = tirerLot(vivier(), TAILLE_LOT, alea("2026-08-20")).map((d) => d.resume.uid);
  const b = tirerLot(vivier(), TAILLE_LOT, alea("2026-08-21")).map((d) => d.resume.uid);
  assert.notDeepEqual(a, b);
});

test("le lot fait la bonne taille, sans doublon", () => {
  const lot = tirerLot(vivier(), TAILLE_LOT, alea("x"));
  assert.equal(lot.length, TAILLE_LOT);
  assert.equal(new Set(lot.map((d) => d.resume.uid)).size, TAILLE_LOT);
});

test("le lot n'est PAS rangé par affinité décroissante", () => {
  // Sur 30 jours, un lot trié serait un hasard improbable ; on exige au moins une remontée.
  const desordre = Array.from({ length: 30 }, (_, j) => {
    const pcts = tirerLot(vivier(), TAILLE_LOT, alea(`jour-${j}`)).map((d) => d.score.pct);
    return pcts.some((p, i) => i > 0 && p > pcts[i - 1]);
  });
  assert.ok(desordre.filter(Boolean).length >= 25);
});

test("chaque lot mêle des profils proches ET éloignés (stratification)", () => {
  // Vivier trié : le tiers haut = pct > 0,40 ; le tiers bas = pct <= 0,20.
  for (let j = 0; j < 20; j++) {
    const lot = tirerLot(vivier(), TAILLE_LOT, alea(`j${j}`));
    assert.ok(lot.some((d) => d.score.pct > 0.4), `lot ${j} sans député proche`);
    assert.ok(lot.some((d) => d.score.pct <= 0.2), `lot ${j} sans député éloigné`);
  }
});

test("vivier plus petit que le lot : tout le monde passe, mélangé", () => {
  const petit = vivier(5);
  const lot = tirerLot(petit, TAILLE_LOT, alea("x"));
  assert.equal(lot.length, 5);
  assert.deepEqual(new Set(lot.map((d) => d.resume.uid)), new Set(petit.map((d) => d.resume.uid)));
});

test("melanger ne modifie pas l'entrée", () => {
  const src = vivier(10);
  const avant = src.map((d) => d.resume.uid);
  melanger(src, alea("y"));
  assert.deepEqual(src.map((d) => d.resume.uid), avant);
});

test("le jour est daté en heure locale (AAAA-MM-JJ)", () => {
  assert.equal(jourCourant(new Date(2026, 7, 20, 23, 30)), "2026-08-20");
  assert.match(jourCourant(), /^\d{4}-\d{2}-\d{2}$/);
});
