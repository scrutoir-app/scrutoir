import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { ACTEURS_DIR, ACTEURS_TOUS_DIR, ORGANES_DIR } from "./download.js";

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
    `INSERT INTO deputes (uid, civilite, prenom, nom, nom_complet, groupe_uid, photo_url, qualite, mandat_debut, mandat_fin, departement, num_departement, circo, actif)
     VALUES (@uid, @civilite, @prenom, @nom, @nom_complet, @groupe_uid, @photo_url, @qualite, @mandat_debut, @mandat_fin, @departement, @num_departement, @circo, 1)
     ON CONFLICT(uid) DO UPDATE SET
       civilite=excluded.civilite, prenom=excluded.prenom, nom=excluded.nom,
       nom_complet=excluded.nom_complet, groupe_uid=excluded.groupe_uid,
       photo_url=excluded.photo_url, qualite=excluded.qualite,
       mandat_debut=excluded.mandat_debut, mandat_fin=excluded.mandat_fin,
       departement=excluded.departement, num_departement=excluded.num_departement, circo=excluded.circo, actif=1`
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

      // Groupe politique courant : mandats GP dont la date de fin est nulle.
      // On privilégie le mandat "Président" si présent (un·e député·e peut avoir
      // plusieurs mandats GP actifs ; le premier n'est pas toujours la présidence).
      const gpActifs = asArray(a.mandats?.mandat).filter(
        (m: any) => m?.typeOrgane === "GP" && !m?.dateFin
      );
      const principal = gpActifs.find((m: any) => m?.infosQualite?.codeQualite === "Président") ?? gpActifs[0];
      const groupeUid: string | null = principal?.organes?.organeRef ?? null;
      const qualite: string | null = principal?.infosQualite?.codeQualite ?? null;

      // Dates du mandat de siège (ASSEMBLEE) — borne le calcul des absences/présence.
      // Plusieurs mandats possibles (interruptions) : début = le plus ancien ;
      // fin = NULL si un mandat est en cours, sinon la fin la plus récente.
      const sieges = asArray(a.mandats?.mandat).filter((m: any) => m?.typeOrgane === "ASSEMBLEE");
      const debuts = sieges.map((m: any) => m?.dateDebut).filter(Boolean) as string[];
      const mandatDebut = debuts.length ? debuts.sort()[0] : null;
      const enCours = sieges.some((m: any) => !m?.dateFin);
      const fins = sieges.map((m: any) => m?.dateFin).filter(Boolean) as string[];
      const mandatFin = enCours || !fins.length ? null : fins.sort().pop()!;

      // Circonscription (du mandat de siège en cours de préférence)
      const siegeActif = sieges.find((m: any) => !m?.dateFin) ?? sieges[0];
      const lieu = siegeActif?.election?.lieu ?? {};
      const departement: string | null = lieu.departement ?? null;
      const numDepartement: string | null = lieu.numDepartement ?? null;
      const circo: string | null = lieu.numCirco ?? null;

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
        qualite,
        mandat_debut: mandatDebut,
        mandat_fin: mandatFin,
        departement,
        num_departement: numDepartement,
        circo,
      });
      n++;
    }
  });
  tx(files);
  return n;
}

/**
 * Complète la table avec les députés SORTIS en cours de législature (remplacés,
 * nommés au gouvernement, démissionnaires…). Source AMO20 « députés, sénateurs,
 * ministres de la législature » : contrairement à AMO10 (actifs seuls), elle contient
 * tous les acteurs ayant siégé — on ne garde que ceux avec un mandat ASSEMBLEE de la
 * législature courante et absents d'AMO10. Sans cette passe, leurs 55 000+ votes
 * s'affichaient sous l'identifiant brut (« PA795958 ») dans les votants des scrutins.
 *
 * Insérés avec actif=0 : exclus de l'index de recherche / « mon député », mais leur
 * identité alimente les votants et leur fiche est exportée (lien cliquable). L'UPSERT
 * ne touche JAMAIS un actif (WHERE deputes.actif = 0) et répare les stubs d'une base
 * locale existante.
 */
export function chargerDeputesSortis(db: Database.Database, legislature = "17"): number {
  if (!fs.existsSync(ACTEURS_TOUS_DIR)) {
    console.warn("  ⚠ AMO20 (tous acteurs) absent — députés sortis non complétés");
    return 0;
  }
  const insert = db.prepare(
    `INSERT INTO deputes (uid, civilite, prenom, nom, nom_complet, groupe_uid, photo_url, qualite, mandat_debut, mandat_fin, departement, num_departement, circo, actif)
     VALUES (@uid, @civilite, @prenom, @nom, @nom_complet, @groupe_uid, @photo_url, @qualite, @mandat_debut, @mandat_fin, @departement, @num_departement, @circo, 0)
     ON CONFLICT(uid) DO UPDATE SET
       civilite=excluded.civilite, prenom=excluded.prenom, nom=excluded.nom,
       nom_complet=excluded.nom_complet, groupe_uid=excluded.groupe_uid,
       photo_url=excluded.photo_url, qualite=excluded.qualite,
       mandat_debut=excluded.mandat_debut, mandat_fin=excluded.mandat_fin,
       departement=excluded.departement, num_departement=excluded.num_departement, circo=excluded.circo
     WHERE deputes.actif = 0`
  );
  const actifs = new Set<string>(
    db.prepare("SELECT uid FROM deputes WHERE actif = 1").all().map((r: any) => r.uid)
  );
  // FK deputes.groupe_uid → groupes : AMO20 porte aussi des mandats GP d'anciennes
  // législatures, dont l'organe n'est pas dans la table (AMO10 ne charge que les GP
  // courants). On ne référence qu'un groupe connu, sinon NULL.
  const groupesConnus = new Set<string>(
    db.prepare("SELECT uid FROM groupes").all().map((r: any) => r.uid)
  );
  let n = 0;
  const files = fs.readdirSync(ACTEURS_TOUS_DIR).filter((f) => f.endsWith(".json"));
  const tx = db.transaction((list: string[]) => {
    for (const f of list) {
      const a = readJson(path.join(ACTEURS_TOUS_DIR, f)).acteur;
      const uid = texte(a?.uid);
      if (!uid || actifs.has(uid)) continue;

      // Uniquement les DÉPUTÉS de la législature courante (AMO20 contient aussi
      // sénateurs et ministres jamais élus députés sur cette législature).
      const sieges = asArray(a.mandats?.mandat).filter(
        (m: any) => m?.typeOrgane === "ASSEMBLEE" && String(m?.legislature ?? "") === legislature
      );
      if (!sieges.length) continue;

      const ident = a.etatCivil?.ident ?? {};
      const prenom = ident.prenom ?? "";
      const nom = ident.nom ?? "";
      if (!`${prenom}${nom}`.trim()) continue; // sans identité, un stub ne vaut pas mieux

      // Groupe politique : mandat GP de la législature courante uniquement (AMO20
      // porte aussi les GP des législatures passées) — l'actif s'il existe, sinon le
      // plus récemment terminé (= le groupe au moment du départ).
      const gps = asArray(a.mandats?.mandat).filter(
        (m: any) => m?.typeOrgane === "GP" && String(m?.legislature ?? "") === legislature
      );
      const gpActif = gps.find((m: any) => !m?.dateFin);
      const gpDernier = [...gps].sort((x: any, y: any) => String(x?.dateFin ?? "").localeCompare(String(y?.dateFin ?? ""))).pop();
      const principal = gpActif ?? gpDernier;
      const gpRef: string | null = principal?.organes?.organeRef ?? null;
      const groupeUid = gpRef && groupesConnus.has(gpRef) ? gpRef : null;
      const qualite: string | null = principal?.infosQualite?.codeQualite ?? null;

      // Bornes du mandat de siège (même logique que chargerDeputes) — indispensables
      // pour une participation calculée sur la seule durée du mandat.
      const debuts = sieges.map((m: any) => m?.dateDebut).filter(Boolean) as string[];
      const mandatDebut = debuts.length ? debuts.sort()[0] : null;
      const enCours = sieges.some((m: any) => !m?.dateFin);
      const fins = sieges.map((m: any) => m?.dateFin).filter(Boolean) as string[];
      const mandatFin = enCours || !fins.length ? null : fins.sort().pop()!;

      const siegeRef = sieges.find((m: any) => !m?.dateFin) ?? sieges[sieges.length - 1];
      const lieu = siegeRef?.election?.lieu ?? {};

      const idNum = uid.replace(/^PA/, "");
      insert.run({
        uid,
        civilite: ident.civ ?? null,
        prenom,
        nom,
        nom_complet: `${prenom} ${nom}`.trim(),
        groupe_uid: groupeUid,
        photo_url: `https://www2.assemblee-nationale.fr/static/tribun/17/photos/${idNum}.jpg`,
        qualite,
        mandat_debut: mandatDebut,
        mandat_fin: mandatFin,
        departement: lieu.departement ?? null,
        num_departement: lieu.numDepartement ?? null,
        circo: lieu.numCirco ?? null,
      });
      n++;
    }
  });
  tx(files);
  return n;
}
