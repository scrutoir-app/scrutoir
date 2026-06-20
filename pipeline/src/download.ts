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

/**
 * Modes de téléchargement :
 *  - défaut         : réutilise le fichier s'il est déjà présent (dev local).
 *  - force          : re-télécharge systématiquement (`--download`).
 *  - refresh        : revalidation conditionnelle **ETag** (`--refresh`, CI quotidienne)
 *                     → re-télécharge seulement si la source a changé (304 sinon).
 *                     Idéal pour le gros Amendements.json.zip (~270 Mo).
 */
export type DownloadOpts = { force?: boolean; refresh?: boolean };

async function telecharger(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Echec telechargement ${url} : ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

type CondResult = "updated" | "unchanged" | "failed";

/**
 * Téléchargement conditionnel via ETag : envoie `If-None-Match` si on a déjà un
 * ETag mémorisé (sidecar `<dest>.etag`). 304 → on garde le fichier local. En cas
 * d'erreur réseau, on retombe sur le fichier existant si présent.
 */
async function telechargerConditionnel(url: string, dest: string): Promise<CondResult> {
  const etagPath = `${dest}.etag`;
  const headers: Record<string, string> = {};
  if (fs.existsSync(dest) && fs.existsSync(etagPath)) {
    headers["If-None-Match"] = fs.readFileSync(etagPath, "utf8").trim();
  }
  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    console.warn(`  ⚠ Réseau ${url} : ${(e as Error).message}`);
    return fs.existsSync(dest) ? "unchanged" : "failed";
  }
  if (res.status === 304) {
    console.log(`  ✓ ${path.basename(dest)} inchangé (304)`);
    return "unchanged";
  }
  if (!res.ok) {
    console.warn(`  ⚠ ${url} : ${res.status}`);
    return fs.existsSync(dest) ? "unchanged" : "failed";
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  const etag = res.headers.get("etag");
  if (etag) fs.writeFileSync(etagPath, etag);
  else if (fs.existsSync(etagPath)) fs.rmSync(etagPath); // pas d'ETag → ne pas garder un sidecar périmé
  console.log(`  ↓ ${path.basename(dest)} mis à jour (${(buf.length / 1e6).toFixed(1)} Mo)`);
  return "updated";
}

/**
 * S'assure que les archives AN sont telechargees et extraites dans data/raw.
 */
export async function assurerDonneesBrutes(opts: DownloadOpts = {}): Promise<void> {
  const { force = false, refresh = false } = opts;
  fs.mkdirSync(RAW_DIR, { recursive: true });
  for (const src of Object.values(SOURCES)) {
    const zipPath = path.join(RAW_DIR, src.zip);
    const outDir = path.join(RAW_DIR, src.dir);
    let downloaded = false; // a-t-on un nouveau zip à ré-extraire ?
    if (refresh) {
      const r = await telechargerConditionnel(src.url, zipPath);
      if (r === "failed") throw new Error(`Téléchargement ${src.zip} impossible (pas de copie locale).`);
      downloaded = r === "updated";
    } else if (force || !fs.existsSync(zipPath)) {
      console.log(`  ↓ Telechargement ${src.zip} ...`);
      await telecharger(src.url, zipPath);
      downloaded = true;
    } else {
      console.log(`  ✓ ${src.zip} deja present`);
    }
    if (downloaded || !fs.existsSync(path.join(outDir, "json"))) {
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

export async function assurerAmendementsZip(opts: DownloadOpts = {}): Promise<boolean> {
  const { force = false, refresh = false } = opts;
  fs.mkdirSync(RAW_DIR, { recursive: true });
  if (refresh) {
    const r = await telechargerConditionnel(AMENDEMENTS_URL, AMENDEMENTS_ZIP);
    return r !== "failed";
  }
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

// Dossiers législatifs (pour compter les propositions de loi par groupe).
export const DOSSIERS_ZIP = path.join(RAW_DIR, "Dossiers.json.zip");
const DOSSIERS_URL = `${BASE}/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip`;

export async function assurerDossiersZip(opts: DownloadOpts = {}): Promise<boolean> {
  const { force = false, refresh = false } = opts;
  fs.mkdirSync(RAW_DIR, { recursive: true });
  if (refresh) {
    const r = await telechargerConditionnel(DOSSIERS_URL, DOSSIERS_ZIP);
    return r !== "failed";
  }
  if (!force && fs.existsSync(DOSSIERS_ZIP)) {
    console.log("  ✓ Dossiers.json.zip deja present");
    return true;
  }
  console.log("  ↓ Telechargement Dossiers.json.zip ...");
  try {
    await telecharger(DOSSIERS_URL, DOSSIERS_ZIP);
    return true;
  } catch (e) {
    console.warn("  ⚠ Echec telechargement dossiers :", (e as Error).message);
    return false;
  }
}

export const SCRUTINS_DIR = path.join(RAW_DIR, "scrutins", "json");
export const ACTEURS_DIR = path.join(RAW_DIR, "amo", "json", "acteur");
export const ORGANES_DIR = path.join(RAW_DIR, "amo", "json", "organe");
