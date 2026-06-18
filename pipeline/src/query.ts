/**
 * Petit script de validation : affiche le profil de vote d'un depute
 * ventile par categorie. Usage : npm run query -- "Nom du depute"
 */
import { openDb } from "./db.js";

const recherche = process.argv.slice(2).join(" ").trim() || "Panot";
const db = openDb();

const depute = db
  .prepare(
    `SELECT d.uid, d.nom_complet, d.photo_url, g.libelle AS groupe, g.abrev
     FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
     WHERE d.actif = 1 AND d.nom_complet LIKE ? COLLATE NOCASE
     LIMIT 1`
  )
  .get(`%${recherche}%`) as any;

if (!depute) {
  console.log(`Aucun depute actif trouve pour "${recherche}".`);
  process.exit(0);
}

console.log(`\n👤 ${depute.nom_complet}  —  ${depute.groupe ?? "?"} (${depute.abrev ?? "?"})`);
console.log(`   ${depute.photo_url}\n`);

const rows = db
  .prepare(
    `SELECT c.emoji, c.libelle,
            SUM(v.position='pour')       AS pour,
            SUM(v.position='contre')     AS contre,
            SUM(v.position='abstention') AS abstention,
            SUM(v.position='nonvotant')  AS absent,
            COUNT(*)                     AS total
     FROM votes v
     JOIN scrutin_categories sc ON sc.scrutin_uid = v.scrutin_uid
     JOIN categories c          ON c.id = sc.categorie_id
     WHERE v.depute_uid = ?
     GROUP BY c.id
     ORDER BY c.ordre`
  )
  .all(depute.uid) as any[];

console.log("Catégorie                              Pour Contre Abst Abs  (% pour exprimés)");
console.log("─".repeat(82));
for (const r of rows) {
  const exprimes = r.pour + r.contre;
  const pct = exprimes ? Math.round((r.pour / exprimes) * 100) : 0;
  const label = `${r.emoji} ${r.libelle}`.padEnd(36);
  console.log(
    `${label} ${String(r.pour).padStart(4)} ${String(r.contre).padStart(6)} ${String(r.abstention).padStart(4)} ${String(r.absent).padStart(4)}   ${pct}%`
  );
}
console.log();
db.close();
