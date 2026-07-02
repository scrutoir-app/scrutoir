#!/usr/bin/env node
/**
 * Sépare le build en DEUX sites Cloudflare Pages (plafond de 20 000 fichiers PAR projet,
 * atteint fin 2026 avec tout dans un seul projet) :
 *   - dist/        → projet `scrutoir`      (app + pages SEO), SANS /data
 *   - .data-site/  → projet `scrutoir-data` (JSON /data/** + _headers CORS),
 *                    servi sur https://data.scrutoir.fr (= EXPO_PUBLIC_DATA_BASE du build).
 *
 * À lancer APRÈS build:web et APRÈS check-data-freshness.mjs (qui lit dist/data/version.json).
 * L'ordre de déploiement qui suit importe : les DONNÉES d'abord, l'app ensuite — les pages
 * SEO fraîchement générées référencent des scrutins qui doivent déjà exister côté data.
 */
import { rename, mkdir, rm, cp, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "..", "dist");
const out = resolve(__dirname, "..", ".data-site");

try {
  await stat(join(dist, "data"));
} catch {
  console.error("[split-data-site] dist/data introuvable — lancer après `npm run build:web` (ou déjà séparé ?).");
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await rename(join(dist, "data"), join(out, "data"));
await cp(resolve(__dirname, "..", "data-project", "_headers"), join(out, "_headers"));
console.log("[split-data-site] dist/data → .data-site/data (+ _headers CORS) — deux sites prêts à déployer.");
