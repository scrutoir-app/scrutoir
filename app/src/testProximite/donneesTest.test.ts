// Contrôle des DONNÉES publiées du test de proximité (app/public/data/test-proximite.json,
// fichier versionné) : chaque groupe de l'hémicycle doit pouvoir entrer dans le spectre.
// Garde contre une clé de groupe périmée : en octobre 2026 l'AN a renommé « UDDPLR » en
// « UDR » ; le fichier, encore indexé « UDDPLR », sortait l'UDR du spectre sans bruit.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { calculerProximite, type QuestionProximite, type Reponse } from "./score";
import { lignesSpectre } from "./spectre";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FICHIER = path.resolve(__dirname, "../../public/data/test-proximite.json");
const questions = JSON.parse(fs.readFileSync(FICHIER, "utf8")) as QuestionProximite[];

test("toutes les clés de groupe sont celles de l'hémicycle (+ NI pour les décomptes)", () => {
  const valides = new Set([...ORDRE_HEMICYCLE, "NI"]);
  for (const q of questions) {
    for (const k of Object.keys(q.positions)) assert.ok(ORDRE_HEMICYCLE.includes(k), `question ${q.id} : position « ${k} »`);
    for (const k of Object.keys(q.decomptes ?? {})) assert.ok(valides.has(k), `question ${q.id} : décompte « ${k} »`);
  }
});

test("le spectre compte chacun des 11 groupes, UDR compris", () => {
  // Répondre comme la majorité de chaque scrutin rend chaque groupe comparable là où il a tranché.
  const reponses: Record<number, Reponse> = {};
  for (const q of questions) {
    const t = q.totaux;
    reponses[q.id] = t && t.contre > t.pour ? "contre" : "pour";
  }
  const res = calculerProximite(questions, reponses, {}, ORDRE_HEMICYCLE.map((abrev) => ({ abrev })));
  const { fiables } = lignesSpectre(res, ORDRE_HEMICYCLE);
  assert.deepEqual(fiables.map((l) => l.abrev).sort(), [...ORDRE_HEMICYCLE].sort());
  const udr = fiables.find((l) => l.abrev === "UDR")!;
  assert.ok(udr.votes >= questions.length - 5, `UDR comparée sur ${udr.votes} votes seulement`);
});
