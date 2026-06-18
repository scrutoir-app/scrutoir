import type Database from "better-sqlite3";
import { openDb } from "./db.js";
import { CATEGORIES, classifierParMotsCles } from "./categories.js";

/** Insere/maj la table des categories de reference. */
export function seedCategories(db: Database.Database): void {
  const ins = db.prepare(
    `INSERT INTO categories (id, libelle, emoji, couleur, ordre)
     VALUES (@id, @libelle, @emoji, @couleur, @ordre)
     ON CONFLICT(id) DO UPDATE SET
       libelle=excluded.libelle, emoji=excluded.emoji, couleur=excluded.couleur, ordre=excluded.ordre`
  );
  const tx = db.transaction(() => {
    CATEGORIES.forEach((c, i) =>
      ins.run({ id: c.id, libelle: c.libelle, emoji: c.emoji, couleur: c.couleur, ordre: i })
    );
  });
  tx();
}

/**
 * Classe tous les scrutins par mots-cles. `reset=true` repart de zero
 * (utile apres ajustement de la taxonomie). Ne touche pas aux lignes
 * source='valide' (validation humaine), qui sont prioritaires.
 */
export function classifierTout(db: Database.Database, reset = false): { lignes: number; nonClasses: number } {
  if (reset) db.prepare("DELETE FROM scrutin_categories WHERE source != 'valide'").run();

  const scrutins = db.prepare("SELECT uid, titre, objet FROM scrutins").all() as Array<{
    uid: string;
    titre: string | null;
    objet: string | null;
  }>;
  const dejaValide = new Set(
    (db.prepare("SELECT DISTINCT scrutin_uid FROM scrutin_categories WHERE source='valide'").all() as any[])
      .map((r) => r.scrutin_uid)
  );

  const ins = db.prepare(
    `INSERT INTO scrutin_categories (scrutin_uid, categorie_id, source, confiance)
     VALUES (?, ?, 'mots-cles', ?)
     ON CONFLICT(scrutin_uid, categorie_id) DO UPDATE SET confiance=excluded.confiance
     WHERE scrutin_categories.source != 'valide'`
  );

  let lignes = 0;
  let nonClasses = 0;
  const tx = db.transaction(() => {
    for (const s of scrutins) {
      if (dejaValide.has(s.uid)) continue;
      const res = classifierParMotsCles(s.titre ?? "", s.objet ?? "");
      if (res.length === 0) {
        nonClasses++;
        continue;
      }
      for (const r of res) {
        ins.run(s.uid, r.categorieId, r.confiance);
        lignes++;
      }
    }
  });
  tx();
  return { lignes, nonClasses };
}

// Execution directe : reclasse tout (mots-cles) sur la base existante.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  seedCategories(db);
  const r = classifierTout(db, true);
  console.log(`Classification terminee : ${r.lignes} associations, ${r.nonClasses} scrutins non classes.`);
  db.close();
}
