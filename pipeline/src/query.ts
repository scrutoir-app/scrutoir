/**
 * Script de validation : profil de vote d'un depute ventile par categorie,
 * avec indicateur de loyaute au groupe. Usage : npm run query -- "Nom"
 */
import { openDb } from "./db.js";
import { rechercheDeputes, profilDepute } from "./stats.js";

const recherche = process.argv.slice(2).join(" ").trim() || "Panot";
const db = openDb();

const trouve = rechercheDeputes(db, recherche, 1)[0];
if (!trouve) {
  console.log(`Aucun depute actif trouve pour "${recherche}".`);
  process.exit(0);
}

const p = profilDepute(db, trouve.uid, "all")!;
const d = p.depute;
console.log(`\n👤 ${d.nom_complet}  —  ${d.groupe ?? "?"} (${d.abrev ?? "?"})`);
console.log(`   Loyaute au groupe (global) : ${p.loyaute_globale_pct ?? "?"}%\n`);

console.log("Catégorie                              Pour Contre Abst Abs   %pour  loyauté");
console.log("─".repeat(82));
for (const c of p.categories) {
  const label = `${c.emoji} ${c.libelle}`.padEnd(36);
  console.log(
    `${label} ${String(c.pour).padStart(4)} ${String(c.contre).padStart(6)} ${String(c.abstention).padStart(4)} ${String(c.absent).padStart(4)}   ${String(c.pct_pour_exprimes ?? "-").padStart(4)}%  ${String(c.loyaute_pct ?? "-").padStart(4)}%`
  );
}
console.log();
db.close();
