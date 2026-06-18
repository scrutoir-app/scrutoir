import { openDb, createSchema } from "./db.js";
import { assurerDonneesBrutes } from "./download.js";
import { chargerGroupes, chargerDeputes } from "./parseActeurs.js";
import { chargerScrutins } from "./parseScrutins.js";
import { seedCategories, classifierTout } from "./classify.js";

async function main() {
  const force = process.argv.includes("--download");
  const t0 = Date.now();

  console.log("1/5  Donnees brutes AN (telechargement/extraction)");
  await assurerDonneesBrutes(force);

  const db = openDb();
  createSchema(db);

  console.log("2/5  Groupes politiques + deputes");
  const nGroupes = chargerGroupes(db);
  const nDeputes = chargerDeputes(db);
  console.log(`     ${nGroupes} groupes, ${nDeputes} deputes actifs`);

  console.log("3/5  Scrutins + votes nominatifs");
  const { scrutins, votes } = chargerScrutins(db);
  console.log(`     ${scrutins} scrutins, ${votes} votes individuels`);

  console.log("4/5  Categories de reference");
  seedCategories(db);

  console.log("5/5  Classification thematique (mots-cles + propagation)");
  const { lignes, propagees, nonClasses } = classifierTout(db, true);
  console.log(`     ${lignes} par mots-cles, ${propagees} propagees aux amendements, ${nonClasses} non classes`);

  db.close();
  console.log(`\n✅ Ingestion terminee en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("❌ Erreur ingestion :", e);
  process.exit(1);
});
