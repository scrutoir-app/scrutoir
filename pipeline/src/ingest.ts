import { openDb, createSchema } from "./db.js";
import { assurerDonneesBrutes, assurerAmendementsZip, assurerDossiersZip } from "./download.js";
import { chargerGroupes, chargerDeputes } from "./parseActeurs.js";
import { chargerScrutins } from "./parseScrutins.js";
import { seedCategories, classifierTout } from "./classify.js";
import { lierAmendements } from "./linkAmendements.js";
import { calculerParticipation } from "./participation.js";
import { calculerPropositions, lierDossiers } from "./activiteGroupes.js";
import { localiserPhotos } from "./photos.js";
import { calculerShuffleConfrontation } from "./shuffleConfrontation.js";
import { detecterQuestions } from "./detecteurQuestions.js";

async function main() {
  const force = process.argv.includes("--download");
  const refresh = process.argv.includes("--refresh");
  const dl = { force, refresh };
  const t0 = Date.now();

  console.log("1/5  Donnees brutes AN (telechargement/extraction)");
  await assurerDonneesBrutes(dl);

  const db = openDb();
  createSchema(db);

  console.log("2/5  Groupes politiques + deputes");
  const nGroupes = chargerGroupes(db);
  const nDeputes = chargerDeputes(db);
  console.log(`     ${nGroupes} groupes, ${nDeputes} deputes actifs`);
  console.log("     · photos des députés (rapatriement local)");
  const ph = await localiserPhotos(db);
  console.log(`       ${ph.local} photos locales${ph.manquantes ? `, ${ph.manquantes} manquantes (URL distante gardée)` : ""}`);

  console.log("3/5  Scrutins + votes nominatifs");
  const { scrutins, votes } = chargerScrutins(db);
  console.log(`     ${scrutins} scrutins, ${votes} votes individuels`);
  console.log("     · taux de participation par depute");
  calculerParticipation(db);

  console.log("4/5  Categories de reference");
  seedCategories(db);

  console.log("5/6  Classification thematique (mots-cles + propagation)");
  const { lignes, propagees, nonClasses } = classifierTout(db, true);
  console.log(`     ${lignes} par mots-cles, ${propagees} propagees aux amendements, ${nonClasses} non classes`);

  console.log("6/6  Exposés des amendements + activité des groupes");
  const okZip = await assurerAmendementsZip(dl);
  if (okZip) {
    const { lies, total } = await lierAmendements(db);
    console.log(`     ${lies}/${total} scrutins sur amendement reliés (+ amendements/groupe)`);
  }
  const okDoss = await assurerDossiersZip(dl);
  if (okDoss) {
    const n = await calculerPropositions(db);
    console.log(`     propositions de loi comptées pour ${n} groupes`);
    const t = await lierDossiers(db);
    console.log(`     ${t} scrutins reliés à l'intitulé officiel de leur dossier`);
  }

  console.log("     · viviers du shuffle de confrontation");
  const sh = calculerShuffleConfrontation(db);
  console.log(`       ${sh.fracture_interne} fractures internes, ${sh.alliance_contre_nature} alliances, ${sh.faux_duel} faux duels`);

  console.log("     · file de candidats du test de proximité (par thème)");
  const q = detecterQuestions(db);
  console.log(`       ${Object.values(q).reduce((s, n) => s + n, 0)} candidats sur ${Object.keys(q).length} thèmes`);

  db.close();
  console.log(`\n✅ Ingestion terminee en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("❌ Erreur ingestion :", e);
  process.exit(1);
});
