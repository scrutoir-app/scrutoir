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

// GARDE-FOU : refuse d'exporter (donc de déployer) si les données semblent cassées
// — ex. l'AN a changé un chemin, un téléchargement a échoué. Sans ça, un refresh
// quotidien raté écraserait les bonnes données en ligne par du vide. On vérifie AVANT
// d'écrire le moindre fichier ; en cas d'anomalie on sort en erreur → la CI s'arrête,
// le déploiement précédent reste en ligne.
{
  const nbDep = (db.prepare("SELECT COUNT(*) AS c FROM deputes WHERE actif = 1").get() as any).c as number;
  const nbScr = (db.prepare("SELECT COUNT(*) AS c FROM scrutins").get() as any).c as number;
  const nbPar = (db.prepare("SELECT COUNT(*) AS c FROM groupes").get() as any).c as number;
  const MIN_DEP = 400, MIN_SCR = 1000, MIN_PAR = 5;
  if (nbDep < MIN_DEP || nbScr < MIN_SCR || nbPar < MIN_PAR) {
    console.error(
      `❌ GARDE-FOU : données suspectes (${nbDep} députés, ${nbScr} scrutins, ${nbPar} groupes).\n` +
      `   Seuils minimaux : ${MIN_DEP}/${MIN_SCR}/${MIN_PAR}. Export ANNULÉ pour ne pas écraser les données en ligne.`
    );
    process.exit(1);
  }
  console.log(`Garde-fou OK : ${nbDep} députés, ${nbScr} scrutins, ${nbPar} groupes.`);
}

fs.mkdirSync(OUT, { recursive: true });

// 1) Index des députés (recherche, listes par département, "mon député")
const deputes = db
  .prepare(
    `SELECT d.uid, d.nom_complet, d.groupe_uid, g.libelle AS groupe, g.abrev, g.couleur, d.photo_url,
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
            s.pour, s.contre, s.abstention,
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
// Par thème : nb de scrutins + date et intitulé du dernier (pour donner du contexte
// dans l'accueil et l'onglet Thèmes — un scrutin compte dans chacune de ses catégories).
write(
  "categories.json",
  db
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(DISTINCT sc.scrutin_uid) FROM scrutin_categories sc WHERE sc.categorie_id = c.id) AS nb_scrutins,
         (SELECT s.date FROM scrutin_categories sc JOIN scrutins s ON s.uid = sc.scrutin_uid
          WHERE sc.categorie_id = c.id ORDER BY s.date DESC, s.numero DESC LIMIT 1) AS derniere_date,
         (SELECT COALESCE(s.dossier_titre, s.titre) FROM scrutin_categories sc JOIN scrutins s ON s.uid = sc.scrutin_uid
          WHERE sc.categorie_id = c.id ORDER BY s.date DESC, s.numero DESC LIMIT 1) AS dernier_titre
       FROM categories c ORDER BY c.ordre`
    )
    .all()
);
write("grands.json", grandsScrutins(db, 100));

// 4) Partis (liste + profil par période)
const partis = listePartis(db);
write("partis.json", partis);
// On calcule tous les profils d'abord, puis on injecte la « moyenne des groupes »
// (cohésion + participation), par période, comme repère affiché sur la fiche parti.
const profilsParParti = partis.map((p) => {
  const profils: Record<string, any> = {};
  for (const per of PERIODES) profils[per] = profilParti(db, p.uid, per);
  return { uid: p.uid, profils };
});
const moyenne = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
for (const per of PERIODES) {
  const vals = profilsParParti.map((pp) => pp.profils[per]).filter(Boolean);
  const cohMoy = moyenne(vals.map((v) => v.cohesion_pct).filter((x) => x != null));
  const partMoy = moyenne(vals.map((v) => v.participation_moy_pct).filter((x) => x != null));
  for (const v of vals) {
    v.cohesion_moy = cohMoy;
    v.participation_moy = partMoy;
  }
}
for (const pp of profilsParParti) write(`parti/${pp.uid}.json`, pp.profils);

// Positions du groupe par scrutin : { scrutin_uid: position } — pour le drill-down
// « scrutins du groupe par thème × position » (clic Pour/Contre/Abstention sur la fiche parti).
const gpStmt = db.prepare("SELECT scrutin_uid, position FROM groupe_positions WHERE groupe_uid = ? AND position IS NOT NULL");
for (const p of partis) {
  const map: Record<string, string> = {};
  for (const r of gpStmt.all(p.uid) as any[]) map[r.scrutin_uid] = r.position;
  write(`groupe/${p.uid}.json`, map);
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

// 6 bis) Viviers du « shuffle » de confrontation, groupés par angle (petit fichier
//        lu une fois côté app ; les DeputeResume sont résolus via l'index deputes).
{
  const angles = ["fracture_interne", "alliance_contre_nature", "faux_duel"] as const;
  const shuffle: Record<string, Array<{ a: string; b: string; communs: number; accords: number; taux: number }>> = {};
  const stmt = db.prepare(
    "SELECT a_uid, b_uid, communs, accords, taux FROM confrontation_shuffle WHERE angle = ? ORDER BY rang"
  );
  for (const angle of angles) {
    shuffle[angle] = (stmt.all(angle) as any[]).map((r) => ({
      a: r.a_uid,
      b: r.b_uid,
      communs: r.communs,
      accords: r.accords,
      taux: Math.round(r.taux * 100), // pourcentage entier (tauxAccord)
    }));
  }
  write("confrontation_shuffle.json", shuffle);
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
