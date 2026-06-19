import StreamZip from "node-stream-zip";
import fs from "node:fs";
import type Database from "better-sqlite3";
import { DOSSIERS_ZIP } from "./download.js";

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
