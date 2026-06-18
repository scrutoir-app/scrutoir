import type Database from "better-sqlite3";
import { openDb } from "./db.js";
import { CATEGORIES, classifierParMotsCles, cleDossier } from "./categories.js";

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
     VALUES (?, ?, ?, ?)
     ON CONFLICT(scrutin_uid, categorie_id) DO UPDATE SET confiance=excluded.confiance
     WHERE scrutin_categories.source != 'valide'`
  );

  // 1) Passe mots-cles. On memorise les categories par dossier legislatif
  //    pour pouvoir ensuite propager le theme aux amendements non classes.
  const catsParDossier = new Map<string, Set<string>>();
  const classes = new Map<string, Set<string>>(); // scrutin_uid -> categories
  for (const s of scrutins) {
    if (dejaValide.has(s.uid)) continue;
    const res = classifierParMotsCles(s.titre ?? "", s.objet ?? "");
    if (res.length === 0) continue;
    const cats = new Set(res.map((r) => r.categorieId));
    classes.set(s.uid, cats);
    const cle = cleDossier(s.titre);
    if (cle) {
      let set = catsParDossier.get(cle);
      if (!set) catsParDossier.set(cle, (set = new Set()));
      cats.forEach((c) => set!.add(c));
    }
  }

  let lignes = 0;
  let propagees = 0;
  let nonClasses = 0;
  const tx = db.transaction(() => {
    for (const s of scrutins) {
      if (dejaValide.has(s.uid)) continue;
      const directes = classes.get(s.uid);
      if (directes) {
        for (const cat of directes) {
          ins.run(s.uid, cat, "mots-cles", 0.6);
          lignes++;
        }
        continue;
      }
      // 2) Propagation : ce scrutin n'a aucun mot-cle, mais d'autres scrutins
      //    du meme dossier en ont -> on herite de leurs categories.
      const cle = cleDossier(s.titre);
      const heritees = cle ? catsParDossier.get(cle) : undefined;
      if (heritees && heritees.size) {
        for (const cat of heritees) {
          ins.run(s.uid, cat, "propage", 0.4);
          propagees++;
        }
      } else {
        nonClasses++;
      }
    }
  });
  tx();
  return { lignes, propagees, nonClasses };
}

// Execution directe : reclasse tout (mots-cles) sur la base existante.
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  seedCategories(db);
  const r = classifierTout(db, true);
  console.log(`Classification : ${r.lignes} mots-cles, ${r.propagees} propagees, ${r.nonClasses} non classes.`);
  db.close();
}
