import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// La base vit dans /data a la racine du projet (partagee avec l'API).
export const DB_PATH = path.resolve(__dirname, "../../data/votes.db");

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
      actif        INTEGER NOT NULL DEFAULT 1
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
      nonvotant    INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS votes (
      scrutin_uid TEXT NOT NULL REFERENCES scrutins(uid),
      depute_uid  TEXT NOT NULL REFERENCES deputes(uid),
      position    TEXT NOT NULL,         -- pour|contre|abstention|nonvotant
      groupe_uid  TEXT,
      PRIMARY KEY (scrutin_uid, depute_uid)
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

    CREATE INDEX IF NOT EXISTS idx_votes_depute   ON votes(depute_uid);
    CREATE INDEX IF NOT EXISTS idx_votes_scrutin  ON votes(scrutin_uid);
    CREATE INDEX IF NOT EXISTS idx_sc_scrutin     ON scrutin_categories(scrutin_uid);
    CREATE INDEX IF NOT EXISTS idx_sc_categorie   ON scrutin_categories(categorie_id);
    CREATE INDEX IF NOT EXISTS idx_deputes_groupe ON deputes(groupe_uid);
    CREATE INDEX IF NOT EXISTS idx_scrutins_date  ON scrutins(date);
  `);
}
