/**
 * Test d'INTÉGRATION sémantique (§11 du brief) — rejouable.
 *
 * Charge le VRAI index (`app/public/data/embeddings.bin` + meta) et le modèle e5-small
 * (cache `.hf-cache`), vectorise des requêtes comme le moteur navigateur (préfixe
 * « query: » + `texteAVectoriser`), calcule le cosinus et vérifie la pertinence du
 * dossier de tête + le rejet du « rien de pertinent ».
 *
 * Lent (charge le modèle ~118 Mo) → script dédié : `cd pipeline && npm run test-semantic`.
 * Prérequis : `npm run embeddings` (index + modèle en cache) au préalable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";
import { texteAVectoriser } from "./aliases";
import { cleDossier } from "./fusion";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../../public/data");
const REPO = path.resolve(__dirname, "../../..");
const DIM = 384;
const SEUIL_SUJET = 0.85; // doit rester aligné avec fusion.ts

const meta = JSON.parse(fs.readFileSync(path.join(DATA, "embeddings.meta.json"), "utf8"));
const bin = new Int8Array(fs.readFileSync(path.join(DATA, "embeddings.bin")).buffer);
const scrutins = JSON.parse(fs.readFileSync(path.join(DATA, "scrutins.json"), "utf8")) as any[];
const titres: Record<string, string> = {};
for (const s of scrutins) titres[s.uid] = s.titre || "";

const normes = new Float32Array(meta.count);
for (let i = 0; i < meta.count; i++) {
  let acc = 0;
  for (let d = 0; d < DIM; d++) {
    const v = bin[i * DIM + d];
    acc += v * v;
  }
  normes[i] = Math.sqrt(acc) || 1e-9;
}

env.allowRemoteModels = true;
env.cacheDir = process.env.HF_CACHE_DIR || path.join(REPO, ".hf-cache");
let extract: any;

async function topDossiers(q: string, n = 3): Promise<{ titres: string[]; topScore: number }> {
  if (!extract) extract = await pipeline("feature-extraction", meta.model, { dtype: "q8" });
  const out: any = await extract("query: " + texteAVectoriser(q), { pooling: "mean", normalize: true });
  const qv = out.data as Float32Array;
  const scores = new Float32Array(meta.count);
  for (let i = 0; i < meta.count; i++) {
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qv[d] * bin[i * DIM + d];
    scores[i] = dot / normes[i];
  }
  const ordre = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]);
  const vus = new Set<string>();
  const tops: string[] = [];
  for (const i of ordre) {
    const t = titres[meta.uids[i]] || "";
    const k = cleDossier(t);
    if (vus.has(k)) continue;
    vus.add(k);
    tops.push(t);
    if (tops.length >= n) break;
  }
  return { titres: tops, topScore: scores[ordre[0]] };
}

test("« droits LGBT » → loi liée (homosexualité / conversion) sans le mot au titre", async () => {
  const r = await topDossiers("droits LGBT");
  const ok = r.titres.some((t) => /homosexualit|conversion/i.test(t));
  assert.ok(ok, "attendu une loi homosexualité/conversion dans le top, obtenu :\n" + r.titres.join("\n"));
});

// NB : « PMA » n'a pas de cible — la loi bioéthique date de 2021 (15e législature),
// absente du corpus 17e. On teste à la place une entité présente au vocabulaire distinctif.
test("« ArcelorMittal » → proposition de loi de nationalisation", async () => {
  const r = await topDossiers("ArcelorMittal");
  const ok = r.titres.some((t) => /arcelor|nationalisation/i.test(t));
  assert.ok(ok, "attendu la PPL nationalisation ArcelorMittal, obtenu :\n" + r.titres.join("\n"));
});

test("« fin de vie » → aide à mourir / soins palliatifs", async () => {
  const r = await topDossiers("fin de vie");
  const ok = r.titres.some((t) => /aide a mourir|aide à mourir|palliatif/i.test(t));
  assert.ok(ok, "attendu un texte fin de vie, obtenu :\n" + r.titres.join("\n"));
});

test("« rien de pertinent » → meilleur cosinus sous le seuil d'affichage", async () => {
  const r = await topDossiers("azerty qsdfgh recette de cuisine");
  assert.ok(
    r.topScore < SEUIL_SUJET,
    `le meilleur score (${r.topScore.toFixed(3)}) devrait être < ${SEUIL_SUJET} (section Sujet masquée)`
  );
});
