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
       (uid, numero, date, titre, objet, type_vote, sort_code, sort_libelle, pour, contre, abstention, nonvotant, dossier_ref, dossier_titre)
     VALUES
       (@uid, @numero, @date, @titre, @objet, @type_vote, @sort_code, @sort_libelle, @pour, @contre, @abstention, @nonvotant, @dossier_ref, @dossier_titre)
     ON CONFLICT(uid) DO UPDATE SET
       titre=excluded.titre, objet=excluded.objet, sort_code=excluded.sort_code,
       pour=excluded.pour, contre=excluded.contre, abstention=excluded.abstention, nonvotant=excluded.nonvotant,
       dossier_ref=excluded.dossier_ref, dossier_titre=excluded.dossier_titre`
  );
  const insVote = db.prepare(
    `INSERT INTO votes (scrutin_uid, depute_uid, position, groupe_uid)
     VALUES (@scrutin_uid, @depute_uid, @position, @groupe_uid)
     ON CONFLICT(scrutin_uid, depute_uid) DO UPDATE SET position=excluded.position`
  );
  // FILET DE SÉCURITÉ : stub pour un depute reference par un vote mais absent des
  // dumps AMO10 (actifs) ET AMO20 (tous acteurs de la legislature, cf. parseActeurs
  // chargerDeputesSortis). Ne devrait plus arriver — le garde-fou d'exportStatic
  // echoue si un stub subsiste (nom_complet = uid s'afficherait en prod).
  const insStub = db.prepare(
    `INSERT OR IGNORE INTO deputes (uid, prenom, nom, nom_complet, actif)
     VALUES (?, '', '', ?, 0)`
  );
  const insGroupePos = db.prepare(
    `INSERT INTO groupe_positions (scrutin_uid, groupe_uid, position)
     VALUES (?, ?, ?)
     ON CONFLICT(scrutin_uid, groupe_uid) DO UPDATE SET position=excluded.position`
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
      // Attention a la negation : "n'a pas adopte" doit etre classe rejete,
      // pas adopte (le sous-texte contient pourtant "adopte").
      const lib = normalize(sortLibelle || "");
      const sortCode =
        lib.includes("pas adopt") || lib.includes("rejet") || lib.includes("repouss")
          ? "rejete"
          : lib.includes("adopt") || lib.includes("approuv")
            ? "adopte"
            : (s.sort?.code ?? null);

      // Rattachement au dossier législatif : la source AN structurée et fiable est
      // `objet.dossierLegislatif` (dossierRef = DLR… + libellé court du dossier). Elle couvre
      // ~1747 scrutins (dont les amendements, que le reverse-link voteRef de `lierDossiers`
      // ne voit jamais). `lierDossiers` complète ENSUITE les trous (votes solennels/motions).
      const dl = s.objet?.dossierLegislatif ?? null;
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
        dossier_ref: dl?.dossierRef ?? null,
        dossier_titre: dl?.libelle ?? null,
      });
      nScrutins++;

      // Ventilation nominative : groupe -> bucket -> votant.acteurRef
      const groupes = asArray(s.ventilationVotes?.organe?.groupes?.groupe);
      for (const grp of groupes) {
        const groupeUid = grp.organeRef ?? null;
        const posMaj = grp.vote?.positionMajoritaire ?? null;
        if (groupeUid && posMaj) insGroupePos.run(uid, groupeUid, posMaj);
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
