import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { SCRUTINS_DIR } from "./download.js";
import { normalize } from "./categories.js";

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

const BUCKETS: Array<[string, string]> = [
  ["pours", "pour"],
  ["contres", "contre"],
  ["abstentions", "abstention"],
  ["nonVotants", "nonvotant"],
];

/** Charge tous les scrutins + le vote nominatif de chaque depute. */
export function chargerScrutins(db: Database.Database): { scrutins: number; votes: number } {
  const insScrutin = db.prepare(
    `INSERT INTO scrutins
       (uid, numero, date, titre, objet, type_vote, sort_code, sort_libelle, pour, contre, abstention, nonvotant)
     VALUES
       (@uid, @numero, @date, @titre, @objet, @type_vote, @sort_code, @sort_libelle, @pour, @contre, @abstention, @nonvotant)
     ON CONFLICT(uid) DO UPDATE SET
       titre=excluded.titre, objet=excluded.objet, sort_code=excluded.sort_code,
       pour=excluded.pour, contre=excluded.contre, abstention=excluded.abstention, nonvotant=excluded.nonvotant`
  );
  const insVote = db.prepare(
    `INSERT INTO votes (scrutin_uid, depute_uid, position, groupe_uid)
     VALUES (@scrutin_uid, @depute_uid, @position, @groupe_uid)
     ON CONFLICT(scrutin_uid, depute_uid) DO UPDATE SET position=excluded.position`
  );
  // Stub pour un depute reference par un vote mais absent du fichier des actifs
  // (ex: depute remplace en cours de legislature). Marque actif=0.
  const insStub = db.prepare(
    `INSERT OR IGNORE INTO deputes (uid, prenom, nom, nom_complet, actif)
     VALUES (?, '', '', ?, 0)`
  );
  const connus = new Set<string>(
    db.prepare("SELECT uid FROM deputes").all().map((r: any) => r.uid)
  );

  let nScrutins = 0;
  let nVotes = 0;
  const files = fs.readdirSync(SCRUTINS_DIR).filter((f) => f.endsWith(".json"));

  const tx = db.transaction((list: string[]) => {
    for (const f of list) {
      const s = readJson(path.join(SCRUTINS_DIR, f)).scrutin;
      const uid = s.uid;
      const dec = s.syntheseVote?.decompte ?? {};
      const sortLibelle = s.sort?.libelle ?? null;
      const sortCode = normalize(sortLibelle || s.sort?.code || "").includes("adopt")
        ? "adopte"
        : normalize(sortLibelle || "").includes("rejet")
          ? "rejete"
          : (s.sort?.code ?? null);

      insScrutin.run({
        uid,
        numero: Number(s.numero) || null,
        date: s.dateScrutin ?? null,
        titre: s.titre ?? null,
        objet: s.objet?.libelle ?? null,
        type_vote: s.typeVote?.libelleTypeVote ?? null,
        sort_code: sortCode,
        sort_libelle: sortLibelle,
        pour: Number(dec.pour) || 0,
        contre: Number(dec.contre) || 0,
        abstention: Number(dec.abstentions) || 0,
        nonvotant: Number(dec.nonVotants) || 0,
      });
      nScrutins++;

      // Ventilation nominative : groupe -> bucket -> votant.acteurRef
      const groupes = asArray(s.ventilationVotes?.organe?.groupes?.groupe);
      for (const grp of groupes) {
        const groupeUid = grp.organeRef ?? null;
        const dn = grp.vote?.decompteNominatif ?? {};
        for (const [bucketKey, position] of BUCKETS) {
          const bucket = dn[bucketKey];
          if (!bucket) continue;
          for (const votant of asArray(bucket.votant)) {
            const depUid = votant?.acteurRef;
            if (!depUid) continue;
            if (!connus.has(depUid)) {
              insStub.run(depUid, depUid);
              connus.add(depUid);
            }
            insVote.run({
              scrutin_uid: uid,
              depute_uid: depUid,
              position,
              groupe_uid: groupeUid,
            });
            nVotes++;
          }
        }
      }
    }
  });
  tx(files);
  return { scrutins: nScrutins, votes: nVotes };
}
