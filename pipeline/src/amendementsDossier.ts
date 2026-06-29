import StreamZip from "node-stream-zip";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { openDb, createSchema } from "./db.js";
import { AMENDEMENTS_ZIP, assurerAmendementsZip } from "./download.js";

/**
 * Agrégats compacts des amendements DÉPOSÉS sur chaque dossier législatif, par auteur.
 *
 * Le dataset Amendements de l'Open Data AN est organisé par dossier :
 *   json/<dossierUid>/<texteRef>/<amendementUid>.json
 * → l'id de dossier (DLR…) est le 2ᵉ segment du chemin. On agrège, par (dossier, auteur) :
 * total déposé, sorts (adoptés/rejetés/tombés/retirés/irrecevables) et concentration par
 * article (article le plus visé + nb d'articles distincts). Aucune donnée unitaire n'est
 * conservée : seules ces lignes (dizaines par dossier) sont écrites en base, puis exportées.
 *
 * Auteur : groupe parlementaire (uid d'organe PO… présent dans `groupes`), ou pseudo-auteur
 * '__gouv__' (Gouvernement) / '__commission__' (rapporteur/commission). Les refs d'organes
 * inconnues (groupes dissous en cours de législature) sont comptées dans le total du dossier
 * mais jamais en ligne (pas de picto de groupe possible) → honnêteté : la somme des lignes
 * affichées peut être < total, ce que l'app explicite.
 *
 * Garde-fou (esprit du refresh quotidien) : si l'archive est absente, ou si l'agrégation
 * ne produit rien (dataset vide/cassé), on N'ÉCRASE PAS les agrégats existants.
 */

function txt(v: any): any {
  return v && typeof v === "object" ? v["#text"] : v;
}

/** Bucket de sort d'un amendement, à partir de son cycle de vie. */
function sortBucket(a: any): "adoptes" | "rejetes" | "tombes" | "retires" | "irrecevables" | "autres" {
  const cdv = a?.cycleDeVie ?? {};
  const sortRaw = cdv.sort;
  const sort = typeof sortRaw === "object" ? null : sortRaw; // {xsi:nil} → null
  const etat = cdv.etatDesTraitements?.etat?.libelle ?? null;
  if (sort === "Adopté") return "adoptes";
  if (sort === "Rejeté") return "rejetes";
  if (sort === "Tombé") return "tombes";
  if (sort === "Retiré") return "retires";
  if (sort == null && etat === "Retiré") return "retires"; // retiré avant discussion
  if (sort == null && typeof etat === "string" && etat.startsWith("Irrecevable")) return "irrecevables";
  return "autres"; // non soutenu, en traitement, à discuter… → "sans suite" non détaillé
}

/** Auteur d'un amendement → uid d'organe (PO…) ou pseudo-auteur. */
function auteurOrgane(a: any): string {
  const aut = a?.signataires?.auteur ?? {};
  const g = aut.gouvernementRef;
  if ((g && !(typeof g === "object" && g["@xsi:nil"] === "true")) || aut.typeAuteur === "Gouvernement") {
    return "__gouv__";
  }
  const rap = aut.auteurRapporteurOrganeRef;
  if (rap && !(typeof rap === "object" && rap["@xsi:nil"] === "true")) return "__commission__";
  const grp = aut.groupePolitiqueRef;
  if (grp && typeof grp !== "object") return String(grp);
  return "__autre__";
}

/** Désignation courte de l'article visé (clé de concentration). */
function article(a: any): string | null {
  const court = a?.pointeurFragmentTexte?.division?.articleDesignationCourte;
  return court ? String(court) : null;
}

interface Agg {
  total: number;
  adoptes: number;
  rejetes: number;
  tombes: number;
  retires: number;
  irrecevables: number;
  arts: Map<string, number>;
}
function newAgg(): Agg {
  return { total: 0, adoptes: 0, rejetes: 0, tombes: 0, retires: 0, irrecevables: 0, arts: new Map() };
}

/**
 * Lit l'archive Amendements en streaming et remplit `dossier_amendements` +
 * `dossier_amendements_totaux`. Retourne le nombre de dossiers et de lignes écrits.
 */
export async function agregerAmendementsDossier(
  db: Database.Database
): Promise<{ dossiers: number; lignes: number }> {
  if (!fs.existsSync(AMENDEMENTS_ZIP)) {
    console.log("  ⚠ Archive amendements absente, agrégats par dossier ignorés.");
    return { dossiers: 0, lignes: 0 };
  }

  const groupesConnus = new Set<string>(
    (db.prepare("SELECT uid FROM groupes").all() as any[]).map((r) => r.uid)
  );

  const zip = new (StreamZip as any).async({ file: AMENDEMENTS_ZIP });
  const noms = Object.keys(await zip.entries()).filter((n) => n.endsWith(".json"));

  // dossier -> auteur -> agrégat
  const parDossier = new Map<string, Map<string, Agg>>();
  let lus = 0;
  for (const nom of noms) {
    const dossier = nom.split("/")[1]; // json/<dossier>/<texte>/<amdt>.json
    if (!dossier) continue;
    const a = JSON.parse((await zip.entryData(nom)).toString("utf8")).amendement;
    if (!a) continue;
    const auteur = auteurOrgane(a);
    let byA = parDossier.get(dossier);
    if (!byA) parDossier.set(dossier, (byA = new Map()));
    let r = byA.get(auteur);
    if (!r) byA.set(auteur, (r = newAgg()));
    r.total++;
    const b = sortBucket(a);
    if (b !== "autres") r[b]++; // "autres" (en cours, non soutenu…) reste dans le total → barre « sans suite »
    const art = article(a);
    if (art) r.arts.set(art, (r.arts.get(art) ?? 0) + 1);
    if (++lus % 20000 === 0) console.log(`     ...${lus} amendements agrégés`);
  }
  await zip.close();

  // GARDE-FOU : dataset vide/cassé → on ne touche pas aux agrégats existants.
  if (parDossier.size === 0) {
    console.log("  ⚠ Aucun amendement agrégé (dataset vide ?), agrégats existants conservés.");
    return { dossiers: 0, lignes: 0 };
  }

  const insLigne = db.prepare(
    `INSERT INTO dossier_amendements
       (dossier, groupe, total, adoptes, rejetes, tombes, retires, irrecevables,
        article_top, article_top_n, articles_distincts)
     VALUES (@dossier, @groupe, @total, @adoptes, @rejetes, @tombes, @retires, @irrecevables,
        @article_top, @article_top_n, @articles_distincts)`
  );
  const insTot = db.prepare(
    `INSERT INTO dossier_amendements_totaux
       (dossier, total, adoptes, total_groupes, nb_groupes)
     VALUES (@dossier, @total, @adoptes, @total_groupes, @nb_groupes)`
  );

  let lignes = 0;
  db.transaction(() => {
    // Remplacement atomique (les données viennent d'être validées non vides).
    db.exec("DELETE FROM dossier_amendements; DELETE FROM dossier_amendements_totaux;");
    for (const [dossier, byA] of parDossier) {
      let totalTous = 0;
      let adoptesTous = 0;
      let totalGroupes = 0;
      let nbGroupes = 0;
      for (const [auteur, r] of byA) {
        totalTous += r.total;
        adoptesTous += r.adoptes;
        const estGroupe = groupesConnus.has(auteur);
        if (estGroupe) {
          totalGroupes += r.total;
          nbGroupes++;
        }
        // On n'écrit en LIGNE que les auteurs identifiables (groupe connu, gouv, commission).
        // Les refs inconnues / '__autre__' restent dans le total du dossier uniquement.
        if (!estGroupe && auteur !== "__gouv__" && auteur !== "__commission__") continue;
        let topArt: string | null = null;
        let topN = 0;
        for (const [art, n] of r.arts) if (n > topN) ((topN = n), (topArt = art));
        insLigne.run({
          dossier,
          groupe: auteur,
          total: r.total,
          adoptes: r.adoptes,
          rejetes: r.rejetes,
          tombes: r.tombes,
          retires: r.retires,
          irrecevables: r.irrecevables,
          article_top: topArt,
          article_top_n: topN,
          articles_distincts: r.arts.size,
        });
        lignes++;
      }
      insTot.run({
        dossier,
        total: totalTous,
        adoptes: adoptesTous,
        total_groupes: totalGroupes,
        nb_groupes: nbGroupes,
      });
    }
  })();

  return { dossiers: parDossier.size, lignes };
}

// Exécution directe : télécharge si besoin + agrège.
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    await assurerAmendementsZip({
      force: process.argv.includes("--download"),
      refresh: process.argv.includes("--refresh"),
    });
    const db = openDb();
    createSchema(db);
    console.log("Agrégation des amendements par dossier (lecture du zip, ~1-2 min)...");
    const r = await agregerAmendementsDossier(db);
    console.log(`✅ ${r.lignes} lignes (auteurs) sur ${r.dossiers} dossiers.`);
    db.close();
  })();
}
