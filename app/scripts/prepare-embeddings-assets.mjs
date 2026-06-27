#!/usr/bin/env node
/**
 * Provisionne les assets de la recherche sémantique dans app/public/ (tous git-ignorés,
 * régénérés au build comme /data — cf. .gitignore : models/, ort/, vendor/*.min.js).
 *
 *   1. /vendor/transformers.web.min.js  ← bundle ESM préfabriqué (chargé hors Metro, cf. embedder.ts)
 *   2. /ort/ort-wasm-simd-threaded.*    ← runtime onnxruntime-web (WASM + glue), auto-hébergé
 *   3. /models/Xenova/multilingual-e5-small/  ← modèle q8 + tokenizer (depuis le cache du pipeline)
 *
 * Le modèle (~118 Mo) est téléchargé par le pipeline lors de `npm run embeddings`
 * (transformers.js le met en cache sous pipeline/node_modules/.../.cache). Lancer ce
 * script APRÈS le pipeline. Idempotent (copie écrasante). Aucun téléchargement réseau ici.
 *
 * Lancement : npm run prepare:embeddings  (chaîné dans build:web)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(__dirname, "..");
const REPO = path.resolve(APP, "..");
const PUBLIC = path.join(APP, "public");

const MODEL_ID = "Xenova/multilingual-e5-small";

function copy(src, dst, label) {
  if (!fs.existsSync(src)) return { ok: false, label, src };
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  const mb = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
  console.log(`  ✓ ${label} (${mb} Mo)`);
  return { ok: true, label, src };
}

function copyDir(src, dst, label) {
  if (!fs.existsSync(src)) return { ok: false, label, src };
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d, `${label}/${entry.name}`);
    else copy(s, d, `${label}/${entry.name}`);
  }
  return { ok: true, label, src };
}

console.log("Provisioning assets recherche sémantique →", PUBLIC);
const missing = [];

// 1) Bundle ESM transformers.js (hors Metro)
const r1 = copy(
  path.join(APP, "node_modules/@huggingface/transformers/dist/transformers.web.min.js"),
  path.join(PUBLIC, "vendor/transformers.web.min.js"),
  "vendor/transformers.web.min.js"
);
if (!r1.ok) missing.push(r1);

// 2) Runtime onnxruntime-web. Les bundles ESM (ort*.bundle.min.mjs) sont les cibles
//    de l'import map (cf. embedder.ts) qui résout les specifiers nus `onnxruntime-web`
//    et `onnxruntime-web/webgpu` du bundle transformers ; les ort-wasm-*.{mjs,wasm}
//    sont le runtime WASM chargé via wasmPaths='/ort/'.
const ortSrc = path.join(APP, "node_modules/onnxruntime-web/dist");
for (const f of [
  "ort.bundle.min.mjs",
  "ort.webgpu.bundle.min.mjs",
  // backend wasm par défaut (ort.bundle.min.mjs) → variante asyncify
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  // backend jsep (webgpu/webnn, si disponible)
  "ort-wasm-simd-threaded.jsep.mjs",
  "ort-wasm-simd-threaded.jsep.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
]) {
  const r = copy(path.join(ortSrc, f), path.join(PUBLIC, "ort", f), `ort/${f}`);
  if (!r.ok) missing.push(r);
}

// 2b) onnxruntime-common : ort.bundle.min.mjs l'importe par specifier nu `onnxruntime-common`
//     (résolu par l'import map vers /ort/common/index.js). C'est une feuille ESM multi-fichiers
//     à imports relatifs `.js` → on copie tout l'arbre esm (que les .js, pas les .map/.d.ts).
const commonEsm = path.join(APP, "node_modules/onnxruntime-common/dist/esm");
if (fs.existsSync(commonEsm)) {
  for (const f of fs.readdirSync(commonEsm).filter((f) => f.endsWith(".js"))) {
    const r = copy(path.join(commonEsm, f), path.join(PUBLIC, "ort/common", f), `ort/common/${f}`);
    if (!r.ok) missing.push(r);
  }
} else {
  missing.push({ ok: false, label: "ort/common (onnxruntime-common/dist/esm)", src: commonEsm });
}

// 3) Modèle + tokenizer depuis le cache HF (rempli par `npm run embeddings`).
//    Emplacement stable `.hf-cache/` (cf. embeddings.ts) ; repli sur l'ancien cache
//    node_modules pour les setups locaux antérieurs.
const cacheDirs = [
  path.join(process.env.HF_CACHE_DIR || path.join(REPO, ".hf-cache"), MODEL_ID),
  path.join(REPO, "pipeline/node_modules/@huggingface/transformers/.cache", MODEL_ID),
];
const modelCache = cacheDirs.find((d) => fs.existsSync(d));
const r3 = modelCache
  ? copyDir(modelCache, path.join(PUBLIC, "models", MODEL_ID), `models/${MODEL_ID}`)
  : { ok: false, label: `models/${MODEL_ID}`, src: cacheDirs.join(" | ") };
if (!r3.ok) missing.push(r3);

// 3b) DÉCOUPAGE du modèle ONNX en morceaux < 24 Mio. Cloudflare Pages refuse tout
//     fichier > 25 Mio ; le modèle q8 fait ~113 Mio. On garde le fichier ENTIER pour le
//     dev (Expo sert public/, pas de SW) et on génère des parts + manifeste : en prod, le
//     SW réassemble le fichier entier à partir des parts (cf. app/public/sw.js), et le
//     fichier entier est retiré du dist avant déploiement (scripts/strip-model-for-pages.mjs).
const CHUNK = 24 * 1024 * 1024;
if (r3.ok) {
  const onnx = path.join(PUBLIC, "models", MODEL_ID, "onnx", "model_quantized.onnx");
  if (fs.existsSync(onnx)) {
    const buf = fs.readFileSync(onnx);
    const dir = path.dirname(onnx);
    // Nettoie d'anciennes parts éventuelles.
    for (const f of fs.readdirSync(dir)) {
      if (/^model_quantized\.onnx\.part\d+$/.test(f)) fs.unlinkSync(path.join(dir, f));
    }
    const n = Math.ceil(buf.length / CHUNK);
    for (let i = 0; i < n; i++) {
      const part = buf.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, buf.length));
      fs.writeFileSync(path.join(dir, `model_quantized.onnx.part${String(i).padStart(3, "0")}`), part);
    }
    fs.writeFileSync(
      path.join(dir, "model_quantized.onnx.parts.json"),
      JSON.stringify({ parts: n, bytes: buf.length, chunk: CHUNK })
    );
    console.log(`  ✓ model_quantized.onnx découpé en ${n} parts < 24 Mio (+ manifeste)`);
  }
}

if (missing.length) {
  console.error("\n❌ Sources manquantes :");
  for (const m of missing) console.error(`   - ${m.label}  (attendu : ${m.src})`);
  console.error(
    "\nAstuce : exécuter d'abord le pipeline (cd pipeline && npm ci && npm run embeddings) " +
      "pour télécharger le modèle, puis `npm ci` dans app/ pour onnxruntime-web."
  );
  process.exit(1);
}
console.log("✅ Assets prêts.");
