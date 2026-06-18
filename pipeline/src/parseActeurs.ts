import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { ACTEURS_DIR, ORGANES_DIR } from "./download.js";

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function asArray<T>(x: T | T[] | null | undefined): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

function texte(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "object") return v["#text"] ?? null;
  return String(v);
}

/** Charge les groupes politiques (organes de type GP) dans la table groupes. */
export function chargerGroupes(db: Database.Database): number {
  const insert = db.prepare(
    `INSERT INTO groupes (uid, libelle, abrev, couleur)
     VALUES (@uid, @libelle, @abrev, @couleur)
     ON CONFLICT(uid) DO UPDATE SET
       libelle=excluded.libelle, abrev=excluded.abrev, couleur=excluded.couleur`
  );
  let n = 0;
  const files = fs.readdirSync(ORGANES_DIR).filter((f) => f.endsWith(".json"));
  const tx = db.transaction((list: string[]) => {
    for (const f of list) {
      const o = readJson(path.join(ORGANES_DIR, f)).organe;
      if (o?.codeType !== "GP") continue;
      insert.run({
        uid: texte(o.uid),
        libelle: o.libelle ?? o.libelleAbrege ?? "Groupe inconnu",
        abrev: o.libelleAbrev ?? o.libelleAbrege ?? null,
        couleur: o.couleurAssociee ?? null,
      });
      n++;
    }
  });
  tx(files);
  return n;
}

/** Charge les deputes avec leur groupe politique courant (mandat GP actif). */
export function chargerDeputes(db: Database.Database): number {
  const insert = db.prepare(
    `INSERT INTO deputes (uid, civilite, prenom, nom, nom_complet, groupe_uid, photo_url, actif)
     VALUES (@uid, @civilite, @prenom, @nom, @nom_complet, @groupe_uid, @photo_url, 1)
     ON CONFLICT(uid) DO UPDATE SET
       civilite=excluded.civilite, prenom=excluded.prenom, nom=excluded.nom,
       nom_complet=excluded.nom_complet, groupe_uid=excluded.groupe_uid,
       photo_url=excluded.photo_url, actif=1`
  );
  let n = 0;
  const files = fs.readdirSync(ACTEURS_DIR).filter((f) => f.endsWith(".json"));
  const tx = db.transaction((list: string[]) => {
    for (const f of list) {
      const a = readJson(path.join(ACTEURS_DIR, f)).acteur;
      const uid = texte(a.uid);
      if (!uid) continue;
      const ident = a.etatCivil?.ident ?? {};
      const prenom = ident.prenom ?? "";
      const nom = ident.nom ?? "";

      // Groupe politique courant : mandat GP dont la date de fin est nulle.
      let groupeUid: string | null = null;
      for (const m of asArray(a.mandats?.mandat)) {
        if (m?.typeOrgane === "GP" && !m?.dateFin) {
          groupeUid = m?.organes?.organeRef ?? null;
          break;
        }
      }

      // Photo officielle AN : id numerique (uid sans le prefixe "PA").
      const idNum = uid.replace(/^PA/, "");
      const photoUrl = `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${idNum}.jpg`;

      insert.run({
        uid,
        civilite: ident.civ ?? null,
        prenom,
        nom,
        nom_complet: `${prenom} ${nom}`.trim(),
        groupe_uid: groupeUid,
        photo_url: photoUrl,
      });
      n++;
    }
  });
  tx(files);
  return n;
}
