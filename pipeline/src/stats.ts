import type Database from "better-sqlite3";

export type Periode = "all" | "12m" | "6m";

/** Renvoie la date plancher ISO pour une periode, ou null pour "all". */
export function bornePeriode(p: Periode, aujourdhui = new Date()): string | null {
  if (p === "all") return null;
  const d = new Date(aujourdhui);
  d.setMonth(d.getMonth() - (p === "12m" ? 12 : 6));
  return d.toISOString().slice(0, 10);
}

export interface DeputeResume {
  uid: string;
  nom_complet: string;
  groupe: string | null;
  abrev: string | null;
  couleur: string | null;
  photo_url: string | null;
}

export function rechercheDeputes(db: Database.Database, q: string, limit = 10): DeputeResume[] {
  return db
    .prepare(
      `SELECT d.uid, d.nom_complet, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url
       FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
       WHERE d.actif = 1 AND d.nom_complet LIKE ? COLLATE NOCASE
       ORDER BY d.nom LIMIT ?`
    )
    .all(`%${q}%`, limit) as DeputeResume[];
}

export interface ScrutinResume {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_code: string | null;
  sort_libelle: string | null;
}

export function rechercheScrutins(db: Database.Database, q: string, limit = 15): ScrutinResume[] {
  return db
    .prepare(
      `SELECT uid, numero, date, titre, objet, sort_code, sort_libelle
       FROM scrutins
       WHERE titre LIKE ? COLLATE NOCASE OR objet LIKE ? COLLATE NOCASE
       ORDER BY date DESC LIMIT ?`
    )
    .all(`%${q}%`, `%${q}%`, limit) as ScrutinResume[];
}

export interface CategorieStats {
  id: string;
  libelle: string;
  emoji: string;
  couleur: string;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  total: number;
  pct_pour_exprimes: number | null;
  loyaute_pct: number | null; // % de votes conformes a la consigne du groupe
  base_loyaute: number; // nb de votes exprimes avec consigne connue
}

export interface ProfilDepute {
  depute: DeputeResume;
  loyaute_globale_pct: number | null;
  categories: CategorieStats[];
}

export function profilDepute(
  db: Database.Database,
  uid: string,
  periode: Periode = "all"
): ProfilDepute | null {
  const depute = db
    .prepare(
      `SELECT d.uid, d.nom_complet, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url
       FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
       WHERE d.uid = ?`
    )
    .get(uid) as DeputeResume | undefined;
  if (!depute) return null;

  const borne = bornePeriode(periode);
  const filtreDate = borne ? "AND s.date >= @borne" : "";
  const params = { uid, borne };

  const categories = db
    .prepare(
      `SELECT c.id, c.libelle, c.emoji, c.couleur,
         SUM(v.position='pour')       AS pour,
         SUM(v.position='contre')     AS contre,
         SUM(v.position='abstention') AS abstention,
         SUM(v.position='nonvotant')  AS absent,
         COUNT(*)                     AS total,
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position IN ('pour','contre','abstention')
                  THEN 1 ELSE 0 END)  AS base_loyaute,
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position = gp.position
                  THEN 1 ELSE 0 END)  AS conformes
       FROM votes v
       JOIN scrutins s            ON s.uid = v.scrutin_uid
       JOIN scrutin_categories sc ON sc.scrutin_uid = v.scrutin_uid
       JOIN categories c          ON c.id = sc.categorie_id
       LEFT JOIN groupe_positions gp
              ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.depute_uid = @uid ${filtreDate}
       GROUP BY c.id ORDER BY c.ordre`
    )
    .all(params) as any[];

  const cats: CategorieStats[] = categories.map((r) => {
    const exprimes = r.pour + r.contre;
    return {
      id: r.id,
      libelle: r.libelle,
      emoji: r.emoji,
      couleur: r.couleur,
      pour: r.pour,
      contre: r.contre,
      abstention: r.abstention,
      absent: r.absent,
      total: r.total,
      pct_pour_exprimes: exprimes ? Math.round((r.pour / exprimes) * 100) : null,
      loyaute_pct: r.base_loyaute ? Math.round((r.conformes / r.base_loyaute) * 100) : null,
      base_loyaute: r.base_loyaute,
    };
  });

  const glob = db
    .prepare(
      `SELECT
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position IN ('pour','contre','abstention')
                  THEN 1 ELSE 0 END) AS base,
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position = gp.position
                  THEN 1 ELSE 0 END) AS conformes
       FROM votes v
       JOIN scrutins s ON s.uid = v.scrutin_uid
       LEFT JOIN groupe_positions gp
              ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.depute_uid = @uid ${filtreDate}`
    )
    .get(params) as any;

  return {
    depute,
    loyaute_globale_pct: glob?.base ? Math.round((glob.conformes / glob.base) * 100) : null,
    categories: cats,
  };
}

/** Derniers grands scrutins : scrutins solennels + motions de censure. */
export function grandsScrutins(db: Database.Database, limit = 30): ScrutinResume[] {
  return db
    .prepare(
      `SELECT uid, numero, date, titre, objet, type_vote, sort_code, sort_libelle,
              pour, contre, abstention
       FROM scrutins
       WHERE type_vote IN ('scrutin public solennel', 'motion de censure')
       ORDER BY date DESC, numero DESC
       LIMIT ?`
    )
    .all(limit) as any[];
}

/** Scrutins rattaches a une categorie, les plus recents d'abord. */
export function scrutinsParCategorie(db: Database.Database, categorieId: string, limit = 40): ScrutinResume[] {
  return db
    .prepare(
      `SELECT s.uid, s.numero, s.date, s.titre, s.objet, s.sort_code, s.sort_libelle,
              s.pour, s.contre, s.abstention
       FROM scrutins s
       JOIN scrutin_categories sc ON sc.scrutin_uid = s.uid
       WHERE sc.categorie_id = ?
       ORDER BY s.date DESC, s.numero DESC
       LIMIT ?`
    )
    .all(categorieId, limit) as any[];
}

/** Dissidences : scrutins ou le depute a vote contre la consigne de son groupe. */
export function dissidences(db: Database.Database, deputeUid: string, limit = 100) {
  return db
    .prepare(
      `SELECT s.uid, s.numero, s.date, s.titre, s.objet, s.sort_libelle,
              v.position, gp.position AS consigne
       FROM votes v
       JOIN scrutins s ON s.uid = v.scrutin_uid
       JOIN groupe_positions gp
         ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.depute_uid = ?
         AND v.position IN ('pour','contre','abstention')
         AND gp.position IS NOT NULL
         AND v.position != gp.position
       ORDER BY s.date DESC, s.numero DESC
       LIMIT ?`
    )
    .all(deputeUid, limit) as any[];
}

/** Detail d'un scrutin : resultat + ventilation par groupe (avec consigne). */
export function detailScrutin(db: Database.Database, uid: string) {
  const scrutin = db
    .prepare(`SELECT * FROM scrutins WHERE uid = ?`)
    .get(uid) as any;
  if (!scrutin) return null;

  const groupes = db
    .prepare(
      `SELECT g.uid, g.libelle, g.abrev, g.couleur,
         gp.position AS consigne,
         SUM(v.position='pour')       AS pour,
         SUM(v.position='contre')     AS contre,
         SUM(v.position='abstention') AS abstention,
         SUM(v.position='nonvotant')  AS absent
       FROM votes v
       JOIN groupes g ON g.uid = v.groupe_uid
       LEFT JOIN groupe_positions gp
              ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.scrutin_uid = ?
       GROUP BY g.uid ORDER BY pour DESC`
    )
    .all(uid) as any[];

  return { scrutin, groupes };
}

/** Recherche le vote precis d'un depute sur un scrutin, avec conformite a la consigne. */
export function voteDeputeSurScrutin(db: Database.Database, scrutinUid: string, deputeUid: string) {
  return db
    .prepare(
      `SELECT v.position, gp.position AS consigne,
              (v.position = gp.position) AS conforme
       FROM votes v
       LEFT JOIN groupe_positions gp
              ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.scrutin_uid = ? AND v.depute_uid = ?`
    )
    .get(scrutinUid, deputeUid) as any;
}
