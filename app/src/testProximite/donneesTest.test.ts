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

// Le texte de méthode (content/infos.ts, METHODE_QUESTIONS) l'affirme dans l'onglet Infos et à
// l'intro du test : « voté par au moins 120 députés » et « onze thèmes, trois questions chacun ».
// Si la sélection change, ce test échoue : mettre à jour le texte en même temps que les données.
test("le texte de méthode dit vrai : 11 thèmes × 3 questions, au moins 120 votants, ids uniques", () => {
  const parTheme: Record<string, number> = {};
  for (const q of questions) parTheme[q.theme] = (parTheme[q.theme] ?? 0) + 1;
  assert.equal(Object.keys(parTheme).length, 11, `thèmes : ${Object.keys(parTheme).join(", ")}`);
  for (const [theme, n] of Object.entries(parTheme)) assert.equal(n, 3, `${theme} : ${n} questions`);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length, "id en double");
  for (const q of questions) {
    const t = q.totaux!;
    assert.ok(t.pour + t.contre + t.abstention >= 120, `question ${q.id} : ${t.pour + t.contre + t.abstention} votants`);
  }
});
