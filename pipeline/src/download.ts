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
  // AMO20 = députés/sénateurs/ministres de la législature, TOUS mandats (y compris
  // terminés). Sert à identifier les députés SORTIS en cours de législature (remplacés,
  // nommés au gouvernement…), absents d'AMO10 mais présents dans les votes — sinon ils
  // s'affichent « PAxxxxxx » en prod. Petit (~2,3 Mo).
  amoTous: {
    url: `${BASE}/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip`,
    zip: "AMO20.json.zip",
    dir: "amo-tous",
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

const ESSAIS = 3; // tentatives par téléchargement (le serveur AN coupe parfois en plein corps)
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function telecharger(url: string, dest: string): Promise<void> {
  for (let essai = 1; ; essai++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // La lecture du corps peut AUSSI échouer (socket coupée à mi-fichier) → dans le retry.
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      return;
    } catch (e) {
      if (essai >= ESSAIS) throw new Error(`Echec telechargement ${url} : ${(e as Error).message}`);
      const ms = essai * 5000;
      console.warn(`  ⚠ ${url} (essai ${essai}/${ESSAIS}) : ${(e as Error).message} — nouvel essai dans ${ms / 1000}s`);
      await attendre(ms);
    }
  }
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
  for (let essai = 1; essai <= ESSAIS; essai++) {
    try {
      const res = await fetch(url, { headers });
      if (res.status === 304) {
        console.log(`  ✓ ${path.basename(dest)} inchangé (304)`);
        return "unchanged";
      }
      if (!res.ok) {
        // 5xx = transitoire → retry ; le reste (404…) ne se réessaie pas.
        if (res.status >= 500 && essai < ESSAIS) throw new Error(`HTTP ${res.status}`);
        console.warn(`  ⚠ ${url} : ${res.status}`);
        return fs.existsSync(dest) ? "unchanged" : "failed";
      }
      // La lecture du corps peut échouer (socket coupée à mi-fichier) → dans le retry.
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      const etag = res.headers.get("etag");
      if (etag) fs.writeFileSync(etagPath, etag);
      else if (fs.existsSync(etagPath)) fs.rmSync(etagPath); // pas d'ETag → ne pas garder un sidecar périmé
      console.log(`  ↓ ${path.basename(dest)} mis à jour (${(buf.length / 1e6).toFixed(1)} Mo)`);
      return "updated";
    } catch (e) {
      if (essai >= ESSAIS) {
        console.warn(`  ⚠ Réseau ${url} : ${(e as Error).message}`);
        return fs.existsSync(dest) ? "unchanged" : "failed";
      }
      const ms = essai * 5000;
      console.warn(`  ⚠ ${url} (essai ${essai}/${ESSAIS}) : ${(e as Error).message} — nouvel essai dans ${ms / 1000}s`);
      await attendre(ms);
    }
  }
  return fs.existsSync(dest) ? "unchanged" : "failed";
}

/**
 * Vérifie l'intégrité d'une archive (`unzip -t`). Un zip tronqué NE DOIT PAS survivre :
 * son sidecar .etag ferait répondre 304 au run suivant → échec en boucle jusqu'à purge
 * manuelle du cache CI. On purge zip + etag → le prochain run re-télécharge (auto-réparation).
 */
function verifierZip(zipPath: string): void {
  try {
    execSync(`unzip -t -qq "${zipPath}"`, { stdio: "pipe" });
  } catch {
    fs.rmSync(zipPath, { force: true });
    fs.rmSync(`${zipPath}.etag`, { force: true });
    throw new Error(
      `Archive corrompue : ${path.basename(zipPath)} — purgée (zip + etag), re-téléchargée au prochain run.`
    );
  }
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
      verifierZip(zipPath); // AVANT de purger l'existant (un zip tronqué ne détruit rien)
      // Purge du dossier extrait : `unzip -o` écrase mais ne supprime jamais les entrées
      // disparues du dump (scrutin annulé, acteur retiré) — sans purge, des fichiers
      // fantômes persistent via le cache CI et rendent l'ingestion non déterministe.
      fs.rmSync(outDir, { recursive: true, force: true });
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
    if (r === "updated") verifierZip(AMENDEMENTS_ZIP); // lu en streaming plus tard : valider ICI
    return r !== "failed" && fs.existsSync(AMENDEMENTS_ZIP);
  }
  if (!force && fs.existsSync(AMENDEMENTS_ZIP)) {
    console.log("  ✓ Amendements.json.zip deja present");
    return true;
  }
  console.log("  ↓ Telechargement Amendements.json.zip (~270 Mo) ...");
  try {
    await telecharger(AMENDEMENTS_URL, AMENDEMENTS_ZIP);
    verifierZip(AMENDEMENTS_ZIP);
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
    if (r === "updated") verifierZip(DOSSIERS_ZIP);
    return r !== "failed" && fs.existsSync(DOSSIERS_ZIP);
  }
  if (!force && fs.existsSync(DOSSIERS_ZIP)) {
    console.log("  ✓ Dossiers.json.zip deja present");
    return true;
  }
  console.log("  ↓ Telechargement Dossiers.json.zip ...");
  try {
    await telecharger(DOSSIERS_URL, DOSSIERS_ZIP);
    verifierZip(DOSSIERS_ZIP);
    return true;
  } catch (e) {
    console.warn("  ⚠ Echec telechargement dossiers :", (e as Error).message);
    return false;
  }
}

export const SCRUTINS_DIR = path.join(RAW_DIR, "scrutins", "json");
export const ACTEURS_DIR = path.join(RAW_DIR, "amo", "json", "acteur");
export const ORGANES_DIR = path.join(RAW_DIR, "amo", "json", "organe");
export const ACTEURS_TOUS_DIR = path.join(RAW_DIR, "amo-tous", "json", "acteur");
