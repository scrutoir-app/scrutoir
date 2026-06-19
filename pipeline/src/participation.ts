import type Database from "better-sqlite3";

/**
 * Calcule le taux de participation aux scrutins publics de chaque député :
 * exprimés / scrutins tenus depuis sa première apparition (proxy d'entrée au
 * mandat, gère les remplaçants). Stocké dans deputes.participation_rate.
 */
export function calculerParticipation(db: Database.Database): number {
  const deputes = db.prepare("SELECT uid FROM deputes").all() as Array<{ uid: string }>;
  const qFirst = db.prepare(
    "SELECT MIN(s.date) d FROM votes v JOIN scrutins s ON s.uid = v.scrutin_uid WHERE v.depute_uid = ?"
  );
  const qExpr = db.prepare(
    "SELECT COUNT(*) n FROM votes WHERE depute_uid = ? AND position IN ('pour','contre','abstention')"
  );
  const qScope = db.prepare("SELECT COUNT(*) n FROM scrutins WHERE date >= ?");
  const upd = db.prepare("UPDATE deputes SET participation_rate = ? WHERE uid = ?");

  let n = 0;
  const tx = db.transaction(() => {
    for (const d of deputes) {
      const first = (qFirst.get(d.uid) as any).d as string | null;
      if (!first) {
        upd.run(null, d.uid);
        continue;
      }
      const expr = (qExpr.get(d.uid) as any).n as number;
      const scope = (qScope.get(first) as any).n as number;
      upd.run(scope > 0 ? expr / scope : null, d.uid);
      n++;
    }
  });
  tx();
  return n;
}
