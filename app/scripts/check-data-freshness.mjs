#!/usr/bin/env node
/**
 * Garde anti-régression de données avant un déploiement Pages MANUEL.
 *
 * `wrangler pages deploy dist` pousse AUSSI `dist/data/**` (copié de app/public/data,
 * la base LOCALE). Si la base locale est en retard sur le cron quotidien, le déploiement
 * FAIT RÉGRESSER les données en prod (incident déjà vécu). Ce script compare le
 * `version.json` qu'on s'apprête à pousser à celui en prod et REFUSE (exit 1) si le
 * local est plus ancien ou plus pauvre.
 *
 * Usage :
 *   node scripts/check-data-freshness.mjs            # vérifie dist/data/version.json
 *   node scripts/check-data-freshness.mjs --force    # avertit mais n'échoue pas
 *   DATA_DIR=public/data node scripts/check-data-freshness.mjs   # autre dossier
 *
 * Réseau injoignable (prod) → on AVERTIT et on laisse passer (ne bloque pas un déploiement
 * pour un souci réseau transitoire ; le premier déploiement n'a pas de prod à comparer).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROD_URL = "https://scrutoir.fr/data/version.json";
const force = process.argv.includes("--force");
const dataDir = process.env.DATA_DIR || "dist/data";
const localPath = resolve(process.cwd(), dataDir, "version.json");

const fail = (msg) => {
  console.error(`\n⛔ ${msg}\n`);
  if (force) {
    console.error("   (--force : on continue malgré tout)\n");
    process.exit(0);
  }
  process.exit(1);
};

let local;
try {
  local = JSON.parse(await readFile(localPath, "utf8"));
} catch {
  fail(`version.json local introuvable (${localPath}). As-tu lancé "npm run build:web" ?`);
}

let prod;
try {
  const res = await fetch(PROD_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  prod = await res.json();
} catch (e) {
  console.warn(`\n⚠️  Prod injoignable (${e.message}) — vérification ignorée, déploiement autorisé.\n`);
  process.exit(0);
}

const tLocal = Date.parse(local.generatedAt);
const tProd = Date.parse(prod.generatedAt);
const olderByDate = Number.isFinite(tLocal) && Number.isFinite(tProd) && tLocal < tProd;
// Champs de comptage présents des deux côtés où le local est strictement inférieur.
const regressions = ["deputes", "scrutins", "partis"].filter(
  (k) => typeof local[k] === "number" && typeof prod[k] === "number" && local[k] < prod[k]
);

const fmt = (v) => `${v.generatedAt}  (députés ${v.deputes} · scrutins ${v.scrutins} · partis ${v.partis})`;

if (olderByDate || regressions.length) {
  fail(
    `RÉGRESSION DE DONNÉES détectée — déploiement bloqué.\n` +
      `   Local : ${fmt(local)}\n` +
      `   Prod  : ${fmt(prod)}\n` +
      (olderByDate ? `   → le local est plus ANCIEN que la prod.\n` : "") +
      (regressions.length ? `   → comptages en baisse : ${regressions.join(", ")}.\n` : "") +
      `   Rafraîchis d'abord la base (npm run ingest:refresh + export:static) ou\n` +
      `   laisse le cron "refresh.yml" déployer. Bypass explicite : --force.`
  );
}

console.log(`✅ Données à jour vs prod — déploiement autorisé.\n   Local : ${fmt(local)}\n   Prod  : ${fmt(prod)}`);
