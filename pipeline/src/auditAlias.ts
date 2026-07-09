/**
 * AUDIT DE COUVERTURE DES ALIAS — « chaque mot trendy matche-t-il un vrai scrutin ? »
 *
 * Passe chaque entrée du dictionnaire `aliases.ts` dans le VRAI index sémantique
 * (`app/public/data/embeddings.bin` + modèle e5-small en cache) exactement comme le
 * moteur navigateur (préfixe « query: » + `texteAVectoriser`), calcule le meilleur
 * cosinus par dossier, et signale les alias SOUS le seuil d'affichage : ce sont des
 * termes qui, aujourd'hui, ne renvoient AUCUN scrutin (« cul-de-sac » de recherche).
 *
 * But : ne plus ajouter d'alias à l'aveugle. Un terme trendy sans cible est légitime
 * (l'AN n'a pas voté dessus) mais doit être CONNU, pas découvert par l'utilisateur.
 *
 * Usage : cd pipeline && npm run audit-alias
 * Prérequis : `npm run embeddings` au préalable (index + modèle en cache .hf-cache).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";
import { ALIASES, texteAVectoriser } from "../../app/src/search/aliases";
import { cleDossier } from "../../app/src/search/fusion";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, "../../app/public/data");
const REPO = path.resolve(__dirname, "../..");
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

async function topDossier(q: string): Promise<{ titre: string; score: number }> {
  if (!extract) extract = await pipeline("feature-extraction", meta.model, { dtype: "q8" });
  const out: any = await extract("query: " + texteAVectoriser(q), { pooling: "mean", normalize: true });
  const qv = out.data as Float32Array;
  let best = -Infinity;
  let bestI = 0;
  for (let i = 0; i < meta.count; i++) {
    let dot = 0;
    for (let d = 0; d < DIM; d++) dot += qv[d] * bin[i * DIM + d];
    const s = dot / normes[i];
    if (s > best) {
      best = s;
      bestI = i;
    }
  }
  return { titre: titres[meta.uids[bestI]] || "(titre inconnu)", score: best };
}

async function main() {
  console.log(
    `Audit de ${ALIASES.length} alias sur ${meta.count} scrutins (index du ${meta.generatedAt}).`
  );
  console.log(`Seuil d'affichage « Sujet » : ${SEUIL_SUJET}\n`);

  const lignes: { concept: string; cle: string; score: number; titre: string }[] = [];
  for (const a of ALIASES) {
    const cle = a.cles[0];
    const { titre, score } = await topDossier(cle);
    lignes.push({ concept: a.concept, cle, score, titre });
  }
  lignes.sort((x, y) => x.score - y.score); // les plus faibles (cul-de-sac) en tête

  const morts = lignes.filter((l) => l.score < SEUIL_SUJET);
  const vivants = lignes.filter((l) => l.score >= SEUIL_SUJET);

  const fmt = (l: { concept: string; score: number; titre: string }) =>
    `${l.score.toFixed(3)}  ${l.concept.padEnd(34)} → ${l.titre.slice(0, 70)}`;

  console.log(`⛔ ${morts.length} alias SANS scrutin affichable (score < ${SEUIL_SUJET}) :`);
  for (const l of morts) console.log("   " + fmt(l));
  console.log(`\n✅ ${vivants.length} alias avec au moins un scrutin pertinent :`);
  for (const l of vivants) console.log("   " + fmt(l));

  // Sortie machine (pour CI / suivi) : liste des concepts morts.
  console.log("\nJSON:" + JSON.stringify(morts.map((l) => l.concept)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
