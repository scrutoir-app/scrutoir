import type Database from "better-sqlite3";
import { openDb } from "./db.js";
import { CATEGORIES } from "./categories.js";

/**
 * Reco 2 — Classification thématique assistée par modèle (Claude API).
 *
 * SCAFFOLD prêt à brancher : la classification courante (mots-clés, ~10% non
 * classés + erreurs) reste la valeur par défaut. Ce module reclasse les scrutins
 * NON classés (et, en option, revalide les douteux) en interrogeant Claude.
 *
 * Activation : définir ANTHROPIC_API_KEY puis `npm run classify:ia`. Sans clé, no-op.
 * Modèle : Haiku 4.5 (rapide/économique, adapté à une classification courte).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const BATCH = 20;

interface Scrutin {
  uid: string;
  titre: string | null;
  objet: string | null;
}

function listeNonClasses(db: Database.Database): Scrutin[] {
  return db
    .prepare(
      `SELECT s.uid, s.titre, s.objet FROM scrutins s
       WHERE NOT EXISTS (SELECT 1 FROM scrutin_categories sc WHERE sc.scrutin_uid = s.uid)`
    )
    .all() as Scrutin[];
}

async function classerBatch(apiKey: string, lot: Scrutin[]): Promise<Record<number, string>> {
  const cats = CATEGORIES.map((c) => `- ${c.id} : ${c.libelle}`).join("\n");
  const items = lot.map((s, i) => `${i}. ${s.titre || s.objet || ""}`).join("\n");
  const prompt =
    `Tu classes des intitulés de scrutins de l'Assemblée Nationale française dans UNE catégorie.\n` +
    `Catégories disponibles (id : libellé) :\n${cats}\n\n` +
    `Pour chaque intitulé numéroté ci-dessous, renvoie l'id de catégorie le plus pertinent, ou "none" ` +
    `si vraiment aucune ne convient (procédural, etc.). Réponds UNIQUEMENT par un JSON : ` +
    `un objet {"<numéro>": "<id|none>"} sans texte autour.\n\n${items}`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const txt: string = data?.content?.[0]?.text ?? "{}";
  const json = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
  return JSON.parse(json) as Record<number, string>;
}

export async function classifierIA(db: Database.Database): Promise<{ classes: number; appels: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("  ⚠️  ANTHROPIC_API_KEY absente — classification IA ignorée (mots-clés conservés).");
    return { classes: 0, appels: 0 };
  }
  const valides = new Set(CATEGORIES.map((c) => c.id));
  const upsert = db.prepare(
    `INSERT INTO scrutin_categories (scrutin_uid, categorie_id, source, confiance)
     VALUES (@uid, @cat, 'ia', 0.8)
     ON CONFLICT(scrutin_uid, categorie_id) DO NOTHING`
  );

  const aTraiter = listeNonClasses(db);
  let classes = 0,
    appels = 0;
  for (let i = 0; i < aTraiter.length; i += BATCH) {
    const lot = aTraiter.slice(i, i + BATCH);
    const map = await classerBatch(apiKey, lot);
    appels++;
    const tx = db.transaction(() => {
      lot.forEach((s, j) => {
        const cat = map[j];
        if (cat && cat !== "none" && valides.has(cat)) {
          upsert.run({ uid: s.uid, cat });
          classes++;
        }
      });
    });
    tx();
    console.log(`  IA : ${Math.min(i + BATCH, aTraiter.length)}/${aTraiter.length} traités, ${classes} classés`);
  }
  return { classes, appels };
}

// Exécution directe : `npm run classify:ia`
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  classifierIA(db).then((r) => console.log(`✅ IA : ${r.classes} scrutins classés en ${r.appels} appels.`));
}
