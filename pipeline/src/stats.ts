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

// Alias usuels de partis -> sigle du groupe en 17e legislature.
// (la 17e a renomme : LR -> "Droite Republicaine"/DR, Renaissance -> EPR, etc.)
const ALIAS_PARTIS: Record<string, string> = {
  lr: "DR", "les republicains": "DR", republicains: "DR", republicain: "DR",
  renaissance: "EPR", macron: "EPR", ensemble: "EPR", majorite: "EPR",
  modem: "DEM", "mouvement democrate": "DEM", democrates: "DEM", democrate: "DEM",
  ps: "SOC", "parti socialiste": "SOC", socialiste: "SOC", socialistes: "SOC",
  lfi: "LFI-NFP", insoumis: "LFI-NFP", insoumise: "LFI-NFP", melenchon: "LFI-NFP",
  nfp: "LFI-NFP", "nouveau front populaire": "LFI-NFP", "france insoumise": "LFI-NFP",
  rn: "RN", "rassemblement national": "RN", "le pen": "RN", bardella: "RN", "front national": "RN", fn: "RN",
  eelv: "ECOS", verts: "ECOS", vert: "ECOS", ecolo: "ECOS", ecologiste: "ECOS", ecologistes: "ECOS", ecologie: "ECOS",
  pcf: "GDR", communiste: "GDR", communistes: "GDR", "gauche democrate": "GDR",
  horizons: "HOR", "edouard philippe": "HOR", philippe: "HOR",
  liot: "LIOT",
  udr: "UDDPLR", ciotti: "UDDPLR", "union des droites": "UDDPLR",
  "non inscrit": "NI", "non inscrits": "NI", ni: "NI",
};

function normaliser(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function rechercheDeputes(db: Database.Database, q: string, limit = 250): DeputeResume[] {
  const like = `%${q}%`;
  const alias = ALIAS_PARTIS[normaliser(q)] ?? null; // sigle de groupe si q est un alias de parti
  // Matche par nom OU par parti (sigle exact, libelle, ou alias usuel).
  // Le sigle est exact (sinon "RN" matcherait "BaRNier"). Les elus du parti remontent en tete.
  return db
    .prepare(
      `SELECT d.uid, d.nom_complet, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url,
         CASE WHEN g.abrev = @q COLLATE NOCASE OR (@alias IS NOT NULL AND g.abrev = @alias) THEN 0
              WHEN g.libelle LIKE @like COLLATE NOCASE THEN 1
              ELSE 2 END AS rang
       FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
       WHERE d.actif = 1
         AND (d.nom_complet LIKE @like COLLATE NOCASE
              OR g.abrev = @q COLLATE NOCASE
              OR g.libelle LIKE @like COLLATE NOCASE
              OR (@alias IS NOT NULL AND g.abrev = @alias))
       ORDER BY rang, d.nom LIMIT @limit`
    )
    .all({ q, like, alias, limit }) as DeputeResume[];
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
  absent: number; // déduit : scrutins du thème (période) où le député n'a pas voté
  total: number; // scrutins du thème sur la période (= pour+contre+abst+absent)
  pct_pour_exprimes: number | null;
  loyaute_pct: number | null;
  base_loyaute: number;
  reussite_pct: number | null; // % de votes exprimés où le résultat a suivi le vote
  gagnes: number; // votes "gagnés" (Pour→adopté / Contre→rejeté)
  perdus: number;
}

export interface ProfilDepute {
  depute: DeputeResume;
  loyaute_globale_pct: number | null;
  participation_pct: number | null; // exprimés / scrutins de la période
  participation_rang_pct: number | null; // plus assidu·e que X % des députés
  reussite_globale_pct: number | null; // % de votes exprimés où le résultat a suivi le vote
  categories: CategorieStats[];
}

export function profilDepute(
  db: Database.Database,
  uid: string,
  periode: Periode = "all"
): ProfilDepute | null {
  const depute = db
    .prepare(
      `SELECT d.uid, d.nom_complet, d.participation_rate, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url
       FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
       WHERE d.uid = ?`
    )
    .get(uid) as (DeputeResume & { participation_rate: number | null }) | undefined;
  if (!depute) return null;

  // Fenêtre = depuis la 1re apparition du député (proxy mandat), bornée par la période.
  const first = (db
    .prepare("SELECT MIN(s.date) d FROM votes v JOIN scrutins s ON s.uid=v.scrutin_uid WHERE v.depute_uid=?")
    .get(uid) as any).d as string | null;
  const borne = bornePeriode(periode);
  const debut = [first, borne].filter(Boolean).sort().pop() ?? null; // max des deux
  const filtreDate = borne ? "AND s.date >= @borne" : "";
  const params = { uid, borne, debut };

  // Votes exprimés du député par catégorie (+ loyauté)
  const parCat = db
    .prepare(
      `SELECT c.id,
         SUM(v.position='pour')       AS pour,
         SUM(v.position='contre')     AS contre,
         SUM(v.position='abstention') AS abstention,
         SUM(CASE WHEN (v.position='pour' AND s.sort_code='adopte') OR (v.position='contre' AND s.sort_code='rejete')
                  THEN 1 ELSE 0 END)  AS gagnes,
         SUM(CASE WHEN (v.position='pour' AND s.sort_code='rejete') OR (v.position='contre' AND s.sort_code='adopte')
                  THEN 1 ELSE 0 END)  AS perdus,
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
       GROUP BY c.id`
    )
    .all(params) as any[];
  const voteMap = new Map<string, any>(parCat.map((r) => [r.id, r]));

  // Périmètre : scrutins de chaque thème tenus pendant la fenêtre du député
  const filtreDebut = debut ? "WHERE s.date >= @debut" : "";
  const scopes = db
    .prepare(
      `SELECT c.id, c.libelle, c.emoji, c.couleur, c.ordre, COUNT(*) AS scope
       FROM scrutin_categories sc
       JOIN scrutins s   ON s.uid = sc.scrutin_uid
       JOIN categories c ON c.id = sc.categorie_id
       ${filtreDebut}
       GROUP BY c.id ORDER BY c.ordre`
    )
    .all(params) as any[];

  const cats: CategorieStats[] = scopes.map((s) => {
    const v = voteMap.get(s.id) ?? {};
    const pour = v.pour ?? 0, contre = v.contre ?? 0, abstention = v.abstention ?? 0;
    const exprimes = pour + contre + abstention;
    const absent = Math.max(0, s.scope - exprimes);
    const gagnes = v.gagnes ?? 0, perdus = v.perdus ?? 0;
    return {
      id: s.id, libelle: s.libelle, emoji: s.emoji, couleur: s.couleur,
      pour, contre, abstention, absent, total: s.scope,
      pct_pour_exprimes: pour + contre ? Math.round((pour / (pour + contre)) * 100) : null,
      loyaute_pct: v.base_loyaute ? Math.round((v.conformes / v.base_loyaute) * 100) : null,
      base_loyaute: v.base_loyaute ?? 0,
      gagnes, perdus,
      reussite_pct: gagnes + perdus ? Math.round((gagnes / (gagnes + perdus)) * 100) : null,
    };
  });

  // Loyauté globale
  const glob = db
    .prepare(
      `SELECT
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position IN ('pour','contre','abstention') THEN 1 ELSE 0 END) AS base,
         SUM(CASE WHEN gp.position IS NOT NULL AND v.position = gp.position THEN 1 ELSE 0 END) AS conformes
       FROM votes v
       JOIN scrutins s ON s.uid = v.scrutin_uid
       LEFT JOIN groupe_positions gp ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
       WHERE v.depute_uid = @uid ${filtreDate}`
    )
    .get(params) as any;

  // Réussite globale : le résultat a-t-il suivi le vote ?
  const reuss = db
    .prepare(
      `SELECT
         SUM(CASE WHEN (v.position='pour' AND s.sort_code='adopte') OR (v.position='contre' AND s.sort_code='rejete') THEN 1 ELSE 0 END) AS gagnes,
         SUM(CASE WHEN (v.position='pour' AND s.sort_code='rejete') OR (v.position='contre' AND s.sort_code='adopte') THEN 1 ELSE 0 END) AS perdus
       FROM votes v JOIN scrutins s ON s.uid = v.scrutin_uid
       WHERE v.depute_uid = @uid ${filtreDate}`
    )
    .get(params) as any;
  const reussiteBase = (reuss?.gagnes ?? 0) + (reuss?.perdus ?? 0);

  // Présence sur la période (exprimés / scrutins tenus)
  const exprPeriode = (db
    .prepare(`SELECT COUNT(*) n FROM votes v JOIN scrutins s ON s.uid=v.scrutin_uid
              WHERE v.depute_uid=@uid AND v.position IN ('pour','contre','abstention') ${filtreDate}`)
    .get(params) as any).n as number;
  const scopePeriode = debut
    ? (db.prepare("SELECT COUNT(*) n FROM scrutins WHERE date >= ?").get(debut) as any).n
    : 0;
  const participation_pct = scopePeriode ? Math.round((exprPeriode / scopePeriode) * 100) : null;

  // Rang relatif (sur le taux global pré-calculé)
  let participation_rang_pct: number | null = null;
  if (depute.participation_rate != null) {
    const r = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM deputes WHERE actif=1 AND participation_rate IS NOT NULL AND participation_rate < ?) AS inf,
           (SELECT COUNT(*) FROM deputes WHERE actif=1 AND participation_rate IS NOT NULL) AS tot`
      )
      .get(depute.participation_rate) as any;
    if (r.tot) participation_rang_pct = Math.round((r.inf / r.tot) * 100);
  }

  return {
    depute,
    loyaute_globale_pct: glob?.base ? Math.round((glob.conformes / glob.base) * 100) : null,
    participation_pct,
    participation_rang_pct,
    reussite_globale_pct: reussiteBase ? Math.round((reuss.gagnes / reussiteBase) * 100) : null,
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

/**
 * Scrutins d'un depute dans une categorie. Si `position` est fourni, filtre sur
 * cette position ; sinon renvoie toutes les positions (avec le champ `position`),
 * pour un affichage groupé.
 */
export function votesDeputeCategorie(
  db: Database.Database,
  deputeUid: string,
  categorieId: string,
  position: string | null,
  periode: Periode = "all"
): any[] {
  const borne = bornePeriode(periode);

  // "absent" = scrutins du thème (depuis l'entrée du député) où il n'a PAS voté.
  if (position === "absent" || position === "nonvotant") {
    const first = (db
      .prepare("SELECT MIN(s.date) d FROM votes v JOIN scrutins s ON s.uid=v.scrutin_uid WHERE v.depute_uid=?")
      .get(deputeUid) as any).d as string | null;
    const debut = [first, borne].filter(Boolean).sort().pop() ?? null;
    const filtreDebut = debut ? "AND s.date >= @debut" : "";
    return db
      .prepare(
        `SELECT s.uid, s.numero, s.date, s.titre, s.objet, s.sort_code, s.sort_libelle, 'absent' AS position
         FROM scrutin_categories sc
         JOIN scrutins s ON s.uid = sc.scrutin_uid
         WHERE sc.categorie_id = @cat ${filtreDebut}
           AND NOT EXISTS (SELECT 1 FROM votes v WHERE v.scrutin_uid = s.uid AND v.depute_uid = @uid)
         ORDER BY s.date DESC, s.numero DESC`
      )
      .all({ uid: deputeUid, cat: categorieId, debut }) as any[];
  }

  const filtreDate = borne ? "AND s.date >= @borne" : "";
  const filtrePos = position ? "AND v.position = @pos" : "";
  return db
    .prepare(
      `SELECT s.uid, s.numero, s.date, s.titre, s.objet, s.sort_code, s.sort_libelle, v.position
       FROM votes v
       JOIN scrutins s            ON s.uid = v.scrutin_uid
       JOIN scrutin_categories sc ON sc.scrutin_uid = v.scrutin_uid
       WHERE v.depute_uid = @uid AND sc.categorie_id = @cat ${filtrePos} ${filtreDate}
       ORDER BY s.date DESC, s.numero DESC`
    )
    .all({ uid: deputeUid, cat: categorieId, pos: position, borne }) as any[];
}

/** Deputes ayant vote une position donnee sur un scrutin (optionnellement filtre par groupe). */
export function votantsScrutin(
  db: Database.Database,
  scrutinUid: string,
  position: string,
  groupeUid?: string
) {
  const filtreGroupe = groupeUid ? "AND v.groupe_uid = @grp" : "";
  return db
    .prepare(
      `SELECT d.uid, d.nom_complet, d.photo_url, g.abrev, g.libelle AS groupe, g.couleur
       FROM votes v
       JOIN deputes d ON d.uid = v.depute_uid
       LEFT JOIN groupes g ON g.uid = v.groupe_uid
       WHERE v.scrutin_uid = @uid AND v.position = @pos ${filtreGroupe}
       ORDER BY g.abrev, d.nom`
    )
    .all({ uid: scrutinUid, pos: position, grp: groupeUid }) as any[];
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

  // Exposé de l'amendement, si ce scrutin porte sur un amendement et qu'on a pu le relier.
  const amendement = db
    .prepare(
      `SELECT numero, auteur, article, dispositif, expose
       FROM amendements WHERE scrutin_uid = ?`
    )
    .get(uid) as any | undefined;

  return { scrutin, groupes, amendement: amendement ?? null };
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
