#!/usr/bin/env node
/**
 * Prépare le dist pour Cloudflare Pages (limite DURE de 25 Mio par fichier).
 *
 *  1. Retire le modèle ENTIER `dist/.../model_quantized.onnx` (~113 Mio) — il n'existe
 *     que pour le dev (Expo sert public/ sans SW). En prod, le service worker réassemble
 *     le modèle à partir des parts < 24 Mio (générées par prepare-embeddings-assets.mjs).
 *  2. GARDE-FOU : échoue si un fichier de dist dépasse 25 Mio (déploiement voué à l'échec).
 *
 * Lancé dans build:web APRÈS `expo export` (qui copie public/ → dist/).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../dist");
const LIMITE = 25 * 1024 * 1024; // 25 Mio

if (!fs.existsSync(DIST)) {
  console.error("❌ dist/ introuvable — lancer après `expo export`.");
  process.exit(1);
}

// 1) Retirer le modèle entier (les parts suffisent en prod via le SW).
const onnx = path.join(DIST, "models/Xenova/multilingual-e5-small/onnx/model_quantized.onnx");
if (fs.existsSync(onnx)) {
  const mb = (fs.statSync(onnx).size / 1024 / 1024).toFixed(1);
  fs.unlinkSync(onnx);
  console.log(`  ✓ retiré du dist : model_quantized.onnx (${mb} Mo) — réassemblé par le SW`);
}

// 2) Garde-fou : aucun fichier > 25 Mio.
const trop = [];
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (fs.statSync(p).size > LIMITE) trop.push([p.replace(DIST, ""), fs.statSync(p).size]);
  }
}
scan(DIST);
if (trop.length) {
  console.error("\n❌ Fichiers > 25 Mio (Cloudflare Pages les refuse) :");
  for (const [f, s] of trop) console.error(`   - ${f} (${(s / 1024 / 1024).toFixed(1)} Mo)`);
  process.exit(1);
}
console.log("✅ dist conforme à Cloudflare Pages (aucun fichier > 25 Mio).");
