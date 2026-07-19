import StreamZip from "node-stream-zip";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { DOSSIERS_ZIP, AMENDEMENTS_ZIP } from "./download.js";

/** Titre officiel par dossier (DLR…) depuis le zip Dossiers. Sert à poser `dossier_titre`. */
async function titresParDossier(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!fs.existsSync(DOSSIERS_ZIP)) return out;
  const zip = new (StreamZip as any).async({ file: DOSSIERS_ZIP });
  for (const nom of Object.keys(await zip.entries())) {
    if (!nom.endsWith(".json")) continue;
    try {
      const d = JSON.parse((await zip.entryData(nom)).toString("utf8")).dossierParlementaire;
      if (d?.uid && d?.titreDossier?.titre) out.set(d.uid, d.titreDossier.titre);
    } catch { /* ignore */ }
  }
  await zip.close();
  return out;
}

/**
 * Rattache au dossier les scrutins d'AMENDEMENT encore sans dossier (source #3) : chaque
 * amendement appartient à un dossier via l'arborescence du zip Amendements
 * (`json/<DLR>/<texte>/<amdt>.json`), et la table `amendements` relie amendement ↔ scrutin.
 * Débloque la grande majorité des scrutins que `objet.dossierLegislatif` (source #1) et le
 * reverse-link voteRef (source #2) ne couvrent pas. NE REMPLIT QUE LES NULS.
 */
export async function lierDossiersParAmendements(db: Database.Database): Promise<number> {
  if (!fs.existsSync(AMENDEMENTS_ZIP)) return 0;
  const zip = new (StreamZip as any).async({ file: AMENDEMENTS_ZIP });
  const amdToDossier = new Map<string, string>();
  for (const nom of Object.keys(await zip.entries())) {
    if (!nom.endsWith(".json")) continue;
    const seg = nom.split("/");
    if (seg.length < 4 || !seg[1].startsWith("DLR")) continue;
    amdToDossier.set(seg[seg.length - 1].replace(/\.json$/, ""), seg[1]);
  }
  await zip.close();

  const titres = await titresParDossier();
  const liens = db.prepare("SELECT scrutin_uid, amendement_uid FROM amendements").all() as { scrutin_uid: string; amendement_uid: string }[];
  const upd = db.prepare("UPDATE scrutins SET dossier_ref = ?, dossier_titre = ? WHERE uid = ? AND dossier_ref IS NULL");
  let n = 0;
  db.transaction(() => {
    for (const { scrutin_uid, amendement_uid } of liens) {
      const d = amdToDossier.get(amendement_uid);
      if (d) n += upd.run(d, titres.get(d) ?? null, scrutin_uid).changes;
    }
  })();
  return n;
}

function txt(v: any): any {
  return v && typeof v === "object" ? v["#text"] : v;
}

/**
 * Compte les propositions de loi déposées par groupe (via le groupe de l'auteur
 * initiateur du dossier). Écrit dans groupe_activite.propositions.
 */
export async function calculerPropositions(db: Database.Database): Promise<number> {
  if (!fs.existsSync(DOSSIERS_ZIP)) {
    console.log("  ⚠ Archive dossiers absente, propositions ignorées.");
    return 0;
  }
  // acteurRef -> groupe courant
  const acteurGroupe = new Map<string, string>(
    (db.prepare("SELECT uid, groupe_uid FROM deputes WHERE groupe_uid IS NOT NULL").all() as any[])
      .map((r) => [r.uid, r.groupe_uid])
  );

  const zip = new (StreamZip as any).async({ file: DOSSIERS_ZIP });
  const noms = Object.keys(await zip.entries()).filter((n) => n.endsWith(".json"));
  const parGroupe = new Map<string, number>();

  for (const nom of noms) {
    const d = JSON.parse((await zip.entryData(nom)).toString("utf8")).dossierParlementaire;
    if (!d) continue;
    const proc = (d.procedureParlementaire?.libelle ?? "").toLowerCase();
    if (!proc.includes("proposition de loi")) continue;
    let act = d.initiateur?.acteurs?.acteur;
    act = Array.isArray(act) ? act[0] : act;
    const ref = act?.acteurRef;
    const grp = ref ? acteurGroupe.get(ref) : undefined;
    if (grp) parGroupe.set(grp, (parGroupe.get(grp) ?? 0) + 1);
  }
  await zip.close();

  const ins = db.prepare(
    `INSERT INTO groupe_activite (groupe_uid, propositions) VALUES (?, ?)
     ON CONFLICT(groupe_uid) DO UPDATE SET propositions=excluded.propositions`
  );
  db.transaction(() => {
    for (const [grp, n] of parGroupe) ins.run(grp, n);
  })();
  return parGroupe.size;
}

/**
 * Rattache à chaque scrutin l'intitulé officiel de son dossier législatif
 * (`titreDossier.titre`), via le lien EXPLICITE et fiable `voteRefs.voteRef` présent
 * dans les actes du dossier. Sert de "résumé officiel" pour les votes sur loi entière
 * et motions (les scrutins sur amendement ont déjà leur exposé). Aucune IA, aucune
 * heuristique de titre. Écrit dans scrutins.dossier_titre.
 */
export async function lierDossiers(db: Database.Database): Promise<number> {
  if (!fs.existsSync(DOSSIERS_ZIP)) {
    console.log("  ⚠ Archive dossiers absente, titres officiels ignorés.");
    return 0;
  }
  const zip = new (StreamZip as any).async({ file: DOSSIERS_ZIP });
  const noms = Object.keys(await zip.entries()).filter((n) => n.endsWith(".json"));

  // scrutin uid -> { titre officiel, uid du dossier } du dossier qui le référence
  const parScrutin = new Map<string, { titre: string; ref: string | null }>();
  for (const nom of noms) {
    const raw = (await zip.entryData(nom)).toString("utf8");
    if (!raw.includes("VTANR")) continue; // dossier sans vote nominatif
    const d = JSON.parse(raw).dossierParlementaire;
    const titre = d?.titreDossier?.titre;
    if (!titre) continue;
    const ref = d?.uid ?? null; // DLR… → jointure avec les agrégats d'amendements
    for (const m of raw.matchAll(/VTANR[A-Z0-9]+/g)) {
      if (!parScrutin.has(m[0])) parScrutin.set(m[0], { titre, ref });
    }
  }
  await zip.close();

  // On COMPLÈTE seulement : la source AN `objet.dossierLegislatif` (posée au parse) fait foi.
  // `lierDossiers` ne remplit que les scrutins encore sans rattachement (votes solennels/motions
  // que les dossiers référencent par voteRef mais que `dossierLegislatif` couvre mal).
  const upd = db.prepare("UPDATE scrutins SET dossier_titre = ?, dossier_ref = ? WHERE uid = ? AND dossier_ref IS NULL");
  let n = 0;
  db.transaction(() => {
    for (const [uid, { titre, ref }] of parScrutin) n += upd.run(titre, ref, uid).changes;
  })();
  return n;
}
