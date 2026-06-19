import type Database from "better-sqlite3";

/**
 * Calcule le taux de participation aux scrutins publics de chaque député :
 * exprimés / scrutins tenus PENDANT son mandat de siège (entre mandat_debut et
 * mandat_fin). Borner aux dates de mandat évite les "absences fantômes" sur les
 * scrutins hors mandat (arrivée par partielle, départ, etc.). À défaut de date de
 * début connue, on retombe sur la 1re apparition du député (proxy). Stocké dans
 * deputes.participation_rate.
 */
export function calculerParticipation(db: Database.Database): number {
  const deputes = db
    .prepare("SELECT uid, mandat_debut, mandat_fin FROM deputes")
    .all() as Array<{ uid: string; mandat_debut: string | null; mandat_fin: string | null }>;
  const qFirst = db.prepare(
    "SELECT MIN(s.date) d FROM votes v JOIN scrutins s ON s.uid = v.scrutin_uid WHERE v.depute_uid = ?"
  );
  const qExpr = db.prepare(
    "SELECT COUNT(*) n FROM votes WHERE depute_uid = ? AND position IN ('pour','contre','abstention')"
  );
  const qScope = db.prepare(
    "SELECT COUNT(*) n FROM scrutins WHERE date >= @debut AND (@fin IS NULL OR date <= @fin)"
  );
  const upd = db.prepare("UPDATE deputes SET participation_rate = ? WHERE uid = ?");

  let n = 0;
  const tx = db.transaction(() => {
    for (const d of deputes) {
      const debut = d.mandat_debut ?? ((qFirst.get(d.uid) as any).d as string | null);
      if (!debut) {
        upd.run(null, d.uid);
        continue;
      }
      const expr = (qExpr.get(d.uid) as any).n as number;
      const scope = (qScope.get({ debut, fin: d.mandat_fin }) as any).n as number;
      upd.run(scope > 0 ? expr / scope : null, d.uid);
      n++;
    }
  });
  tx();
  return n;
}
