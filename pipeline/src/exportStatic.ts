import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import {
  profilDepute,
  detailScrutin,
  grandsScrutins,
  listePartis,
  profilParti,
  dissidences,
  type Periode,
} from "./stats.js";

/**
 * Export "tout statique" : transforme la base SQLite en fichiers JSON déposables
 * sur un CDN (Cloudflare Pages). L'app lit ces fichiers (aucun serveur en prod).
 * Réutilise la logique de stats.ts → données identiques à l'API dynamique.
 *
 * Sortie : app/public/data/  → servi par Expo web en dev ET copié dans dist/ à
 * l'export (même origine, pas de CORS). L'app lit /data/... en relatif.
 *   deputes.json, scrutins.json, categories.json, partis.json, grands.json
 *   parti/<uid>.json, depute/<uid>.json, scrutin/<uid>.json
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../app/public/data");
const PERIODES: Periode[] = ["all", "12m", "6m"];

function write(rel: string, data: unknown) {
  const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
}

const db = openDb();
fs.mkdirSync(OUT, { recursive: true });

// 1) Index des députés (recherche, listes par département, "mon député")
const deputes = db
  .prepare(
    `SELECT d.uid, d.nom_complet, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url,
            d.departement, d.num_departement, d.circo
     FROM deputes d LEFT JOIN groupes g ON g.uid = d.groupe_uid
     WHERE d.actif = 1 ORDER BY d.nom`
  )
  .all();
write("deputes.json", deputes);

// 2) Index des scrutins (LÉGER : pour recherche + jointures ; sans objet/votants,
//    qui restent dans les fichiers par scrutin). Chargé 1× côté app.
const scrutinsRaw = db
  .prepare(
    `SELECT s.uid, s.numero, s.date, s.titre, s.sort_code, s.type_vote,
            (SELECT sc.categorie_id FROM scrutin_categories sc WHERE sc.scrutin_uid = s.uid
             ORDER BY sc.confiance DESC LIMIT 1) AS categorie,
            (SELECT group_concat(sc2.categorie_id) FROM scrutin_categories sc2 WHERE sc2.scrutin_uid = s.uid) AS cats
     FROM scrutins s ORDER BY s.date DESC, s.numero DESC`
  )
  .all() as any[];
// categorie = principale (picto, confrontation) ; cats[] = toutes (appartenance thème,
// cohérent avec les agrégats du profil qui comptent un scrutin dans chaque catégorie).
const scrutins = scrutinsRaw.map((s) => ({ ...s, cats: s.cats ? String(s.cats).split(",") : [] }));
write("scrutins.json", scrutins);

// 3) Référentiels
write("categories.json", db.prepare("SELECT * FROM categories ORDER BY ordre").all());
write("grands.json", grandsScrutins(db, 100));

// 4) Partis (liste + profil par période)
const partis = listePartis(db);
write("partis.json", partis);
for (const p of partis) {
  const profils: Record<string, unknown> = {};
  for (const per of PERIODES) profils[per] = profilParti(db, p.uid, per);
  write(`parti/${p.uid}.json`, profils);
}

// 5) Députés : profil (3 périodes) + dissidences + carte des votes (position + consigne)
const votesStmt = db.prepare(
  `SELECT v.scrutin_uid, v.position, gp.position AS consigne
   FROM votes v
   LEFT JOIN groupe_positions gp ON gp.scrutin_uid = v.scrutin_uid AND gp.groupe_uid = v.groupe_uid
   WHERE v.depute_uid = ?`
);
const mandatStmt = db.prepare("SELECT mandat_debut, mandat_fin, groupe_uid FROM deputes WHERE uid = ?");
let nd = 0;
for (const d of deputes as any[]) {
  const profils: Record<string, unknown> = {};
  for (const per of PERIODES) profils[per] = profilDepute(db, d.uid, per);
  const m = mandatStmt.get(d.uid) as any;
  const votes: Record<string, [string, string | null]> = {};
  for (const v of votesStmt.all(d.uid) as any[]) votes[v.scrutin_uid] = [v.position, v.consigne ?? null];
  write(`depute/${d.uid}.json`, {
    mandat_debut: m?.mandat_debut ?? null,
    mandat_fin: m?.mandat_fin ?? null,
    groupe_uid: m?.groupe_uid ?? null,
    profils,
    dissidences: dissidences(db, d.uid, 100),
    votes,
  });
  if (++nd % 100 === 0) console.log(`  députés ${nd}/${deputes.length}`);
}

// 6) Scrutins : détail (ventilation par groupe + amendement) + votants groupés
const votantsStmt = db.prepare(
  `SELECT v.position, v.groupe_uid, d.uid, d.nom_complet, d.photo_url, g.abrev, g.libelle AS groupe, g.couleur
   FROM votes v
   JOIN deputes d ON d.uid = v.depute_uid
   LEFT JOIN groupes g ON g.uid = v.groupe_uid
   WHERE v.scrutin_uid = ? ORDER BY g.abrev, d.nom`
);
const allScrutinUids = db.prepare("SELECT uid FROM scrutins").all() as { uid: string }[];
let ns = 0;
for (const { uid } of allScrutinUids) {
  const detail = detailScrutin(db, uid);
  if (!detail) continue;
  const votants: Record<string, any[]> = { pour: [], contre: [], abstention: [], nonvotant: [] };
  for (const v of votantsStmt.all(uid) as any[]) {
    (votants[v.position] ??= []).push({
      uid: v.uid, nom_complet: v.nom_complet, photo_url: v.photo_url,
      abrev: v.abrev, groupe: v.groupe, couleur: v.couleur, groupe_uid: v.groupe_uid,
    });
  }
  write(`scrutin/${uid}.json`, { ...detail, votants });
  if (++ns % 1000 === 0) console.log(`  scrutins ${ns}/${allScrutinUids.length}`);
}

// 7) version.json : cache-busting / détection de nouveau déploiement (lu par le SW
// en network-first, et exploitable côté app pour un futur bandeau « mise à jour »).
write("version.json", {
  generatedAt: new Date().toISOString(),
  deputes: deputes.length,
  scrutins: ns,
  partis: partis.length,
});

console.log(`✅ Export statique terminé : ${deputes.length} députés, ${ns} scrutins, ${partis.length} partis → ${OUT}`);
