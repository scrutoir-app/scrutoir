import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// La base vit dans /data a la racine du projet (partagee avec l'API).
// Surchargée par la variable d'env DB_PATH (utile en déploiement où la base est
// téléchargée dans un dossier inscriptible, ex. /tmp).
export const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../../data/votes.db");

export function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

/**
 * Cree le schema (idempotent). Modele relationnel pense pour etre porte
 * tel quel vers Postgres / Supabase le jour de la mise en ligne.
 */
export function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groupes (
      uid       TEXT PRIMARY KEY,        -- ex: PO845419
      libelle   TEXT NOT NULL,           -- "Socialistes et apparentes"
      abrev     TEXT,                    -- "SOC"
      couleur   TEXT                     -- "#F5B4CE"
    );

    CREATE TABLE IF NOT EXISTS deputes (
      uid          TEXT PRIMARY KEY,     -- ex: PA1008
      civilite     TEXT,
      prenom       TEXT NOT NULL,
      nom          TEXT NOT NULL,
      nom_complet  TEXT NOT NULL,
      groupe_uid   TEXT REFERENCES groupes(uid),
      photo_url    TEXT,
      actif        INTEGER NOT NULL DEFAULT 1,
      participation_rate REAL,           -- exprimés / scrutins pendant le mandat
      qualite      TEXT,                 -- qualité dans le groupe (Président, Membre…)
      mandat_debut TEXT,                 -- début du mandat de siège (ASSEMBLEE)
      mandat_fin   TEXT,                 -- fin du mandat (NULL = en cours)
      departement  TEXT,                 -- nom du département de la circonscription
      num_departement TEXT,              -- code département (ex: "33", "2A")
      circo        TEXT                  -- numéro de circonscription
    );

    CREATE TABLE IF NOT EXISTS scrutins (
      uid          TEXT PRIMARY KEY,     -- ex: VTANR5L17V6654
      numero       INTEGER,
      date         TEXT,                 -- ISO YYYY-MM-DD
      titre        TEXT,
      objet        TEXT,
      type_vote    TEXT,
      sort_code    TEXT,                 -- "adopte" / "rejete"
      sort_libelle TEXT,
      pour         INTEGER DEFAULT 0,
      contre       INTEGER DEFAULT 0,
      abstention   INTEGER DEFAULT 0,
      nonvotant    INTEGER DEFAULT 0,
      dossier_titre TEXT,                 -- intitulé officiel du dossier législatif (titreDossier.titre)
      dossier_ref   TEXT                  -- uid du dossier législatif (DLR…) → jointure agrégats amendements
    );

    CREATE TABLE IF NOT EXISTS votes (
      scrutin_uid TEXT NOT NULL REFERENCES scrutins(uid),
      depute_uid  TEXT NOT NULL REFERENCES deputes(uid),
      position    TEXT NOT NULL,         -- pour|contre|abstention|nonvotant
      groupe_uid  TEXT,
      PRIMARY KEY (scrutin_uid, depute_uid)
    );

    -- Consigne de vote (position majoritaire) de chaque groupe par scrutin,
    -- fournie directement par l'AN. Sert a calculer la loyaute des deputes.
    CREATE TABLE IF NOT EXISTS groupe_positions (
      scrutin_uid TEXT NOT NULL REFERENCES scrutins(uid),
      groupe_uid  TEXT NOT NULL,
      position    TEXT,                  -- pour|contre|abstention
      PRIMARY KEY (scrutin_uid, groupe_uid)
    );

    -- Activité par groupe : amendements et propositions de loi déposés.
    CREATE TABLE IF NOT EXISTS groupe_activite (
      groupe_uid   TEXT PRIMARY KEY REFERENCES groupes(uid),
      amendements  INTEGER DEFAULT 0,
      propositions INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS categories (
      id      TEXT PRIMARY KEY,          -- "ecologie"
      libelle TEXT NOT NULL,             -- "Ecologie & Climat"
      emoji   TEXT,
      couleur TEXT,
      ordre   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scrutin_categories (
      scrutin_uid  TEXT NOT NULL REFERENCES scrutins(uid),
      categorie_id TEXT NOT NULL REFERENCES categories(id),
      source       TEXT NOT NULL DEFAULT 'mots-cles', -- mots-cles | ia | valide
      confiance    REAL DEFAULT 0,
      PRIMARY KEY (scrutin_uid, categorie_id)
    );

    -- Exposé (brief) de l'amendement rattache a un scrutin (jointure heuristique
    -- date + numero + auteur, ~91% des scrutins sur amendement).
    CREATE TABLE IF NOT EXISTS amendements (
      scrutin_uid    TEXT PRIMARY KEY REFERENCES scrutins(uid),
      amendement_uid TEXT,
      numero         INTEGER,
      auteur         TEXT,
      article        TEXT,
      dispositif     TEXT,   -- ce que l'amendement modifie
      expose         TEXT    -- exposé sommaire (justification)
    );

    -- Agrégats compacts des amendements DÉPOSÉS sur un dossier législatif, par auteur
    -- (groupe parlementaire, ou pseudo-auteur '__gouv__' / '__commission__'). PRÉ-CALCULÉ
    -- au pipeline : on n'exporte JAMAIS les amendements unitaires (dizaines de milliers),
    -- seulement ces lignes. La colonne groupe = uid d'organe (PO… connu) ou pseudo-auteur ; les refs
    -- d'organes inconnus/dissous sont fondues dans la ligne de totaux (cf. dossier_amendements_totaux),
    -- jamais affichées en ligne (pas de picto de groupe possible).
    CREATE TABLE IF NOT EXISTS dossier_amendements (
      dossier           TEXT NOT NULL,        -- uid du dossier (DLR…)
      groupe            TEXT NOT NULL,        -- uid d'organe (PO…) | '__gouv__' | '__commission__'
      total             INTEGER NOT NULL DEFAULT 0,
      adoptes           INTEGER NOT NULL DEFAULT 0,
      rejetes           INTEGER NOT NULL DEFAULT 0,
      tombes            INTEGER NOT NULL DEFAULT 0,
      retires           INTEGER NOT NULL DEFAULT 0,
      irrecevables      INTEGER NOT NULL DEFAULT 0,
      article_top       TEXT,                 -- désignation courte de l'article le plus visé (ex. "ART. 4")
      article_top_n     INTEGER DEFAULT 0,    -- nb d'amendements sur cet article
      articles_distincts INTEGER DEFAULT 0,   -- nb d'articles distincts visés
      PRIMARY KEY (dossier, groupe)
    );

    -- Une ligne de totaux par dossier (tous auteurs confondus, gouv + commission + refs
    -- inconnues incluses) + repères pour la "moyenne des groupes" (parlementaires seuls).
    CREATE TABLE IF NOT EXISTS dossier_amendements_totaux (
      dossier        TEXT PRIMARY KEY,
      total          INTEGER NOT NULL DEFAULT 0,   -- tous auteurs
      adoptes        INTEGER NOT NULL DEFAULT 0,   -- tous auteurs
      total_groupes  INTEGER NOT NULL DEFAULT 0,   -- somme sur les groupes parlementaires connus
      nb_groupes     INTEGER NOT NULL DEFAULT 0    -- nb de groupes parlementaires ayant déposé
    );

    -- Paires de députés pré-calculées pour le « shuffle » de la confrontation.
    -- Trois angles, chacun porteur d'une surprise (cf. shuffleConfrontation.ts) ;
    -- on ne stocke que les meilleurs candidats par angle, jamais toute la matrice.
    CREATE TABLE IF NOT EXISTS confrontation_shuffle (
      angle    TEXT NOT NULL,            -- 'fracture_interne' | 'alliance_contre_nature' | 'faux_duel'
      a_uid    TEXT NOT NULL REFERENCES deputes(uid),
      b_uid    TEXT NOT NULL REFERENCES deputes(uid),
      communs  INTEGER NOT NULL,         -- scrutins nominatifs où A et B ont tous deux voté
      accords  INTEGER NOT NULL,         -- scrutins où ils ont voté pareil
      taux     REAL NOT NULL,            -- accords / communs (0..1)
      rang     INTEGER NOT NULL,         -- 1 = candidat le plus marqué pour l'angle
      PRIMARY KEY (angle, a_uid, b_uid)
    );

    CREATE INDEX IF NOT EXISTS idx_gp_scrutin     ON groupe_positions(scrutin_uid);
    CREATE INDEX IF NOT EXISTS idx_votes_depute   ON votes(depute_uid);
    CREATE INDEX IF NOT EXISTS idx_votes_scrutin  ON votes(scrutin_uid);
    CREATE INDEX IF NOT EXISTS idx_sc_scrutin     ON scrutin_categories(scrutin_uid);
    CREATE INDEX IF NOT EXISTS idx_sc_categorie   ON scrutin_categories(categorie_id);
    CREATE INDEX IF NOT EXISTS idx_deputes_groupe ON deputes(groupe_uid);
    CREATE INDEX IF NOT EXISTS idx_scrutins_date  ON scrutins(date);
  `);

  // Migrations pour bases existantes (ALTER ignoré si la colonne existe déjà).
  try {
    db.exec("ALTER TABLE deputes ADD COLUMN participation_rate REAL");
  } catch {
    /* colonne déjà présente */
  }
  try {
    db.exec("ALTER TABLE deputes ADD COLUMN qualite TEXT");
  } catch {
    /* colonne déjà présente */
  }
  try {
    db.exec("ALTER TABLE scrutins ADD COLUMN dossier_titre TEXT");
  } catch {
    /* colonne déjà présente */
  }
  try {
    db.exec("ALTER TABLE scrutins ADD COLUMN dossier_ref TEXT");
  } catch {
    /* colonne déjà présente */
  }
}
