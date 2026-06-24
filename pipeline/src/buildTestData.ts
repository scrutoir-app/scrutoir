import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";

/**
 * Compile les questions VALIDÉES à la main (file du Brain) en données servies par l'app
 * pour le « test de proximité ». Lit chaque questions/<theme>.json, ne garde que
 * statut == "valide", récupère les TOTAUX réels du scrutin dans votes.db, et écrit
 * app/public/data/test-proximite.json. Ne modifie pas le détecteur (les positions par
 * groupe viennent déjà du fichier candidat ; on n'ajoute ici que les totaux).
 *
 * Local-only (lit le Brain). Lancer : npm run build-test-data.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = process.env.QUESTIONS_OUT
  ? path.resolve(process.env.QUESTIONS_OUT)
  : "/Users/anthonyrousseau/Brain/01 - Projects/Scrutoir/questions";
const OUT = path.resolve(__dirname, "../../app/public/data/test-proximite.json");

if (!fs.existsSync(QUESTIONS_DIR)) {
  console.error(`❌ Dossier des questions introuvable : ${QUESTIONS_DIR}`);
  process.exit(1);
}

const db = openDb();
const parUid = db.prepare("SELECT pour, contre, abstention FROM scrutins WHERE uid = ?");
const parNumero = db.prepare("SELECT pour, contre, abstention FROM scrutins WHERE numero = ?");

interface Sortie {
  id: number;
  theme: string;
  these: string | null;
  famille_clivage: string;
  positions: Record<string, string>;
  totaux: { pour: number; contre: number; abstention: number };
  source_url: string;
}

const out: Sortie[] = [];
let ignores = 0;
for (const f of fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith(".json"))) {
  const theme = f.replace(/\.json$/, "");
  const arr = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, f), "utf8")) as any[];
  for (const q of arr) {
    if (q.statut !== "valide") continue;
    const t = (q.uid && parUid.get(q.uid)) || (q.numero != null && parNumero.get(q.numero));
    if (!t) { console.warn(`⚠️ totaux introuvables pour le scrutin ${q.numero} (${theme})`); ignores++; continue; }
    out.push({
      id: q.numero,
      theme,
      these: q.these ?? null,
      famille_clivage: q.famille_clivage,
      positions: q.positions_par_groupe ?? {},
      totaux: { pour: (t as any).pour, contre: (t as any).contre, abstention: (t as any).abstention },
      source_url: `https://www.assemblee-nationale.fr/dyn/17/scrutins/${q.numero}`,
    });
  }
}
db.close();

// Tri déterministe (thème puis id) → diffs stables, sortie idempotente.
out.sort((a, b) => a.theme.localeCompare(b.theme) || a.id - b.id);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

const themes = [...new Set(out.map((q) => q.theme))].sort();
console.log(`✅ ${out.length} questions validées → ${OUT}`);
console.log(`   thèmes : ${themes.join(", ")}`);
if (ignores) console.log(`   ⚠️ ${ignores} ignorées (totaux manquants)`);
