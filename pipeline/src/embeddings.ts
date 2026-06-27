import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";
import { openDb } from "./db.js";

/**
 * Génère l'INDEX D'EMBEDDINGS de tous les scrutins pour la recherche sémantique
 * (100 % gratuit : modèle open-source `multilingual-e5-small`, exécuté en local).
 *
 * Pour chaque scrutin on compose un "passage" à partir des champs existants
 * (intitulé de dossier + titre + thèmes), on le vectorise (384 dims), puis on
 * écrit UN fichier binaire compact (int8) + un méta JSON (modèle, version, dim,
 * échelle, uids dans l'ordre). ⚠️ Plafond 20 000 fichiers Cloudflare Pages →
 * un seul fichier d'index, jamais un par scrutin.
 *
 * Le MÊME modèle (`@huggingface/transformers`) tourne côté navigateur → vecteurs
 * compatibles. Préfixe e5 "passage:" ici, "query:" côté client (obligatoire).
 *
 * Sortie : app/public/data/embeddings.bin + embeddings.meta.json
 * Lancement : npm run embeddings
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../app/public/data");

// ⚠️ Verrou de compatibilité : doit être IDENTIQUE côté navigateur.
export const EMBED_MODEL = "Xenova/multilingual-e5-small";
// Bumper si on change de modèle, de dimension ou de composition du passage →
// régénère l'index et force le client à recharger (vérif au chargement).
export const EMBED_VERSION = "1";
const DIM = 384;

interface Row {
  uid: string;
  titre: string | null;
  objet: string | null;
  dossier_titre: string | null;
  cats: string | null;
}

/** Texte vectorisé : intitulé officiel + titre + thèmes (champs existants, neutre). */
function passage(r: Row): string {
  const parts: string[] = [];
  const principal = (r.dossier_titre || r.titre || r.objet || "").trim();
  if (principal) parts.push(principal);
  if (r.titre && r.dossier_titre && r.titre.trim() !== r.dossier_titre.trim()) {
    parts.push(r.titre.trim());
  }
  if (r.cats) parts.push(r.cats);
  return "passage: " + parts.join(". ").replace(/\s+/g, " ").trim();
}

async function main() {
  const db = openDb();
  const rows = db
    .prepare(
      `SELECT s.uid, s.titre, s.objet, s.dossier_titre,
         (SELECT group_concat(c.libelle, ', ') FROM scrutin_categories sc
          JOIN categories c ON c.id = sc.categorie_id WHERE sc.scrutin_uid = s.uid) AS cats
       FROM scrutins s ORDER BY s.date DESC, s.numero DESC`
    )
    .all() as Row[];

  console.log(`Embeddings : ${rows.length} scrutins, modèle ${EMBED_MODEL} (q8)…`);
  env.allowRemoteModels = true; // télécharge le modèle depuis HF (mis en cache)
  const extract = await pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });

  // 1) Vectorisation (float32 en mémoire) + suivi du max absolu pour quantifier au mieux.
  const uids: string[] = new Array(rows.length);
  const floats = new Float32Array(rows.length * DIM);
  let maxAbs = 1e-6;
  const BATCH = 32;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const out: any = await extract(slice.map(passage), { pooling: "mean", normalize: true });
    if (out.dims[1] !== DIM) throw new Error(`Dimension inattendue ${out.dims[1]} ≠ ${DIM}`);
    const data = out.data as Float32Array;
    for (let j = 0; j < slice.length; j++) {
      uids[i + j] = slice[j].uid;
      const dst = (i + j) * DIM;
      const src = j * DIM;
      for (let d = 0; d < DIM; d++) {
        const v = data[src + d];
        floats[dst + d] = v;
        const a = Math.abs(v);
        if (a > maxAbs) maxAbs = a;
      }
    }
    if (i % 1600 === 0) console.log(`  ${i}/${rows.length}`);
  }

  // 2) Quantification int8 avec échelle adaptée (utilise toute la plage [-127,127]).
  const scale = 127 / maxAbs;
  const q = new Int8Array(rows.length * DIM);
  for (let k = 0; k < floats.length; k++) {
    let v = Math.round(floats[k] * scale);
    if (v > 127) v = 127;
    else if (v < -127) v = -127;
    q[k] = v;
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "embeddings.bin"), Buffer.from(q.buffer, q.byteOffset, q.byteLength));
  fs.writeFileSync(
    path.join(OUT, "embeddings.meta.json"),
    JSON.stringify({
      model: EMBED_MODEL,
      version: EMBED_VERSION,
      dim: DIM,
      scale, // déquantification côté client : float = int8 / scale
      count: uids.length,
      generatedAt: new Date().toISOString(),
      uids, // mapping ligne → uid de scrutin
    })
  );
  const mb = (q.byteLength / 1024 / 1024).toFixed(2);
  console.log(`✅ Index : ${uids.length} vecteurs × ${DIM} (int8) = ${mb} Mo + embeddings.meta.json (scale=${scale.toFixed(1)})`);
}

main().catch((e) => {
  console.error("❌ Erreur embeddings :", e);
  process.exit(1);
});
