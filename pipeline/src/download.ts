import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RAW_DIR = path.resolve(__dirname, "../../data/raw");

const BASE = "https://data.assemblee-nationale.fr/static/openData/repository/17";

const SOURCES = {
  scrutins: {
    url: `${BASE}/loi/scrutins/Scrutins.json.zip`,
    zip: "Scrutins.json.zip",
    dir: "scrutins",
  },
  amo: {
    url: `${BASE}/amo/deputes_actifs_mandats_actifs_organes/AMO10_deputes_actifs_mandats_actifs_organes.json.zip`,
    zip: "AMO10.json.zip",
    dir: "amo",
  },
} as const;

async function telecharger(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Echec telechargement ${url} : ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

/**
 * S'assure que les archives AN sont telechargees et extraites dans data/raw.
 * Si force=true, re-telecharge meme si present (donnees mises a jour quotidiennement).
 */
export async function assurerDonneesBrutes(force = false): Promise<void> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const src of Object.values(SOURCES)) {
    const zipPath = path.join(RAW_DIR, src.zip);
    const outDir = path.join(RAW_DIR, src.dir);
    if (force || !fs.existsSync(zipPath)) {
      console.log(`  ↓ Telechargement ${src.zip} ...`);
      await telecharger(src.url, zipPath);
    } else {
      console.log(`  ✓ ${src.zip} deja present`);
    }
    if (force || !fs.existsSync(path.join(outDir, "json"))) {
      console.log(`  ⇪ Extraction ${src.zip} ...`);
      fs.mkdirSync(outDir, { recursive: true });
      execSync(`unzip -o -q "${zipPath}" -d "${outDir}"`);
    }
  }
}

// Archive des amendements : on la lit en streaming (pas d'extraction des
// ~116k fichiers sur disque). On telecharge juste le zip si absent.
export const AMENDEMENTS_ZIP = path.join(RAW_DIR, "Amendements.json.zip");
const AMENDEMENTS_URL = `${BASE}/loi/amendements_div_legis/Amendements.json.zip`;

export async function assurerAmendementsZip(force = false): Promise<boolean> {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  if (!force && fs.existsSync(AMENDEMENTS_ZIP)) {
    console.log("  ✓ Amendements.json.zip deja present");
    return true;
  }
  console.log("  ↓ Telechargement Amendements.json.zip (~270 Mo) ...");
  try {
    await telecharger(AMENDEMENTS_URL, AMENDEMENTS_ZIP);
    return true;
  } catch (e) {
    console.warn("  ⚠ Echec telechargement amendements :", (e as Error).message);
    return false;
  }
}

export const SCRUTINS_DIR = path.join(RAW_DIR, "scrutins", "json");
export const ACTEURS_DIR = path.join(RAW_DIR, "amo", "json", "acteur");
export const ORGANES_DIR = path.join(RAW_DIR, "amo", "json", "organe");
