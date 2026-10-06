#!/usr/bin/env node
/**
 * Garde anti-régression de données avant un déploiement Pages (manuel OU cron CI).
 *
 * Le déploiement pousse `dist/data/**` (copié de app/public/data, la base LOCALE en
 * manuel) vers le projet Pages « scrutoir-data ». Si cette base est en retard sur la
 * prod, le déploiement FAIT RÉGRESSER les données (incident déjà vécu). Ce script
 * compare le `version.json` qu'on s'apprête à pousser à celui en prod et REFUSE
 * (exit 1) si le local est plus ancien ou plus pauvre.
 *
 * Usage :
 *   node scripts/check-data-freshness.mjs            # vérifie dist/data/version.json
 *   node scripts/check-data-freshness.mjs --force    # avertit mais n'échoue pas
 *   DATA_DIR=public/data node scripts/check-data-freshness.mjs   # autre dossier
 *
 * Baisse du nombre de députés : légitime quand des députés quittent l'Assemblée
 * (sénatoriales, gouvernement, démission…). Elle est ACCEPTÉE si chaque député présent
 * en prod mais absent du local a sa fiche `depute/<uid>.json` locale avec un
 * `mandat_fin` déjà passé (= sortie confirmée par l'AN). Sinon : blocage.
 *
 * Réseau injoignable (prod) → on AVERTIT et on laisse passer (ne bloque pas un déploiement
 * pour un souci réseau transitoire ; le premier déploiement n'a pas de prod à comparer).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Les données vivent sur le projet Pages dédié « scrutoir-data » : on essaie dans
// l'ordre domaine custom → repli *.pages.dev → ancienne origine (valable avant la
// bascule, puis via la redirection 301 de _redirects). Premier succès = référence.
const PROD_URLS = [
  "https://data.scrutoir.fr/data/version.json",
  "https://scrutoir-data.pages.dev/data/version.json",
  "https://scrutoir.fr/data/version.json",
];
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

let prod = null;
let prodUrl = null;
let derniereErreur = "aucune URL essayée";
for (const url of PROD_URLS) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    prod = await res.json();
    prodUrl = url;
    break;
  } catch (e) {
    derniereErreur = `${url} → ${e.message}`;
  }
}
if (!prod) {
  console.warn(`\n⚠️  Prod injoignable (${derniereErreur}) — vérification ignorée, déploiement autorisé.\n`);
  process.exit(0);
}

const tLocal = Date.parse(local.generatedAt);
const tProd = Date.parse(prod.generatedAt);
const olderByDate = Number.isFinite(tLocal) && Number.isFinite(tProd) && tLocal < tProd;
// Champs de comptage présents des deux côtés où le local est strictement inférieur.
let regressions = ["deputes", "scrutins", "partis"].filter(
  (k) => typeof local[k] === "number" && typeof prod[k] === "number" && local[k] < prod[k]
);

// Baisse de députés : on vérifie que chaque disparu est une sortie de mandat avérée.
let sortiesJustifiees = null;
if (regressions.includes("deputes")) {
  sortiesJustifiees = await justifierSorties();
  if (sortiesJustifiees.ok) regressions = regressions.filter((k) => k !== "deputes");
}

async function justifierSorties() {
  let prodDeputes, localDeputes;
  try {
    const res = await fetch(new URL("deputes.json", prodUrl), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    prodDeputes = await res.json();
    localDeputes = JSON.parse(await readFile(resolve(process.cwd(), dataDir, "deputes.json"), "utf8"));
  } catch (e) {
    return { ok: false, raison: `listes de députés illisibles (${e.message})` };
  }
  const locaux = new Set(localDeputes.map((d) => d.uid));
  const partis = prodDeputes.filter((d) => !locaux.has(d.uid));
  const maintenant = Date.now();
  const sorties = [];
  const injustifies = [];
  for (const d of partis) {
    let fin = null;
    try {
      fin = JSON.parse(await readFile(resolve(process.cwd(), dataDir, "depute", `${d.uid}.json`), "utf8")).mandat_fin;
    } catch {}
    const t = Date.parse(fin);
    if (Number.isFinite(t) && t <= maintenant) sorties.push(`${d.nom_complet} (fin ${fin})`);
    else injustifies.push(`${d.nom_complet} [${d.uid}]`);
  }
  return { ok: injustifies.length === 0, sorties, injustifies };
}

const fmt = (v) => `${v.generatedAt}  (députés ${v.deputes} · scrutins ${v.scrutins} · partis ${v.partis})`;

if (olderByDate || regressions.length) {
  fail(
    `RÉGRESSION DE DONNÉES détectée — déploiement bloqué.\n` +
      `   Local : ${fmt(local)}\n` +
      `   Prod  : ${fmt(prod)}\n` +
      (olderByDate ? `   → le local est plus ANCIEN que la prod.\n` : "") +
      (regressions.length ? `   → comptages en baisse : ${regressions.join(", ")}.\n` : "") +
      (sortiesJustifiees && !sortiesJustifiees.ok
        ? `   → députés disparus sans fin de mandat confirmée : ${
            sortiesJustifiees.raison ?? sortiesJustifiees.injustifies.join(", ")
          }.\n`
        : "") +
      `   Rafraîchis d'abord la base (npm run ingest:refresh + export:static) ou\n` +
      `   laisse le cron "refresh.yml" déployer. Bypass explicite : --force.`
  );
}

if (sortiesJustifiees?.ok) {
  console.log(
    `ℹ️  ${sortiesJustifiees.sorties.length} député(s) sorti(s) de l'Assemblée (fin de mandat confirmée) :\n` +
      sortiesJustifiees.sorties.map((x) => `   - ${x}`).join("\n")
  );
}
console.log(`✅ Données à jour vs prod — déploiement autorisé.\n   Local : ${fmt(local)}\n   Prod  : ${fmt(prod)}`);
