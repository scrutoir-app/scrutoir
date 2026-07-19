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
  // Les VOTES et CONSIGNES sont vérifiés aussi : un renommage de champ dans le JSON AN
  // peut laisser passer 7 000 scrutins « vides » (profils/participation à zéro) — les
  // seuls comptages députés/scrutins/groupes n'y verraient rien.
  const nbVotes = (db.prepare("SELECT COUNT(*) AS c FROM votes").get() as any).c as number;
  const nbGp = (db.prepare("SELECT COUNT(*) AS c FROM groupe_positions").get() as any).c as number;
  const nbAmend = (db.prepare("SELECT COUNT(*) AS c FROM amendements").get() as any).c as number;
  // Ordres de grandeur réels (juil. 2026) : 1 179 670 votes, 90 756 consignes, 5 915 exposés.
  const MIN_DEP = 400, MIN_SCR = 1000, MIN_PAR = 5, MIN_VOTES = 900_000, MIN_GP = 50_000, MIN_AMEND = 3_000;
  if (nbDep < MIN_DEP || nbScr < MIN_SCR || nbPar < MIN_PAR || nbVotes < MIN_VOTES || nbGp < MIN_GP || nbAmend < MIN_AMEND) {
    console.error(
      `❌ GARDE-FOU : données suspectes (${nbDep} députés, ${nbScr} scrutins, ${nbPar} groupes, ` +
      `${nbVotes} votes, ${nbGp} consignes, ${nbAmend} exposés d'amendements).\n` +
      `   Seuils minimaux : ${MIN_DEP}/${MIN_SCR}/${MIN_PAR}/${MIN_VOTES}/${MIN_GP}/${MIN_AMEND}. ` +
      `Export ANNULÉ pour ne pas écraser les données en ligne.`
    );
    process.exit(1);
  }
  // FRAÎCHEUR : si l'AN déplace une URL, le mode refresh « réussit » sur données figées
  // et version.json se met à jour quand même — la prod vieillirait en silence. Le dernier
  // scrutin ne doit pas dater de plus de 120 jours (marge large pour l'intersession d'été).
  const maxDate = (db.prepare("SELECT MAX(date) AS d FROM scrutins").get() as any).d as string | null;
  const MAX_AGE_JOURS = 120;
  const age = maxDate ? Math.floor((Date.now() - Date.parse(maxDate)) / 86_400_000) : Infinity;
  if (age > MAX_AGE_JOURS) {
    console.error(
      `❌ GARDE-FOU : dernier scrutin daté du ${maxDate} (${age} jours) > ${MAX_AGE_JOURS} jours.\n` +
      `   Source AN probablement figée (URL déplacée ? 304 permanent ?). Export ANNULÉ.`
    );
    process.exit(1);
  }
  // Aucun votant ne doit rester anonyme : un stub (nom_complet = uid, cf. parseScrutins)
  // signifierait qu'un député manque des dumps AMO10 + AMO20 → « PAxxxxxx » en prod.
  const stubs = db.prepare("SELECT uid FROM deputes WHERE nom_complet = uid").all() as { uid: string }[];
  if (stubs.length > 0) {
    console.error(
      `❌ GARDE-FOU : ${stubs.length} député(s) sans identité (stub) : ${stubs.slice(0, 10).map((s) => s.uid).join(", ")}${stubs.length > 10 ? "…" : ""}.\n` +
      `   Vérifier l'ingestion AMO20 (chargerDeputesSortis). Export ANNULÉ.`
    );
    process.exit(1);
  }
  console.log(
    `Garde-fou OK : ${nbDep} députés, ${nbScr} scrutins, ${nbPar} groupes, ${nbVotes} votes, ` +
    `${nbGp} consignes, ${nbAmend} exposés, 0 stub, dernier scrutin ${maxDate} (${age} j).`
  );
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
    `SELECT s.uid, s.numero, s.date, s.titre, s.sort_code, s.type_vote, s.dossier_ref,
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

// 2bis) DOSSIERS (regroupement par texte) — socle de la vue « Tes accords » par texte.
// Index léger `dossiers.json` + un fichier par dossier `dossier/<ref>.json` listant ses scrutins
// PUBLICS ordonnés, chacun avec la position MAJORITAIRE de chaque groupe (pour recolorer
// l'hémicycle « comme toi » sans charger le détail de chaque scrutin). ~223 fichiers (bien sous
// le plafond Cloudflare). Honnêteté : uniquement les scrutins publics nominatifs, jamais tous
// les amendements de la loi.
function natureScrutin(objet: string | null, titre: string | null): "amendement" | "article" | "ensemble" | "motion" | "autre" {
  const t = `${objet ?? ""} ${titre ?? ""}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/l['’ ]?ensemble\b/.test(t) || /vote solennel/.test(t)) return "ensemble";
  if (/amendement/.test(t)) return "amendement";
  if (/motion|question prealable|motion de rejet|motion de censure/.test(t)) return "motion";
  if (/\barticle\b/.test(t)) return "article";
  return "autre";
}
const dossierScrutinsQ = db.prepare(
  `SELECT uid, numero, date, titre, objet, sort_code
   FROM scrutins WHERE dossier_ref = ? ORDER BY numero`
);
const posQ = db.prepare(
  `SELECT g.abrev AS abrev, gp.position AS position
   FROM groupe_positions gp JOIN groupes g ON g.uid = gp.groupe_uid
   WHERE gp.scrutin_uid = ? AND g.abrev IS NOT NULL`
);
const catDossierQ = db.prepare(
  `SELECT sc.categorie_id AS cat, COUNT(*) n
   FROM scrutins s JOIN scrutin_categories sc ON sc.scrutin_uid = s.uid
   WHERE s.dossier_ref = ? GROUP BY sc.categorie_id ORDER BY n DESC LIMIT 1`
);
const dossiersRows = db
  .prepare(
    `SELECT dossier_ref AS ref, MAX(dossier_titre) AS titre, COUNT(*) AS nb_scrutins, MAX(date) AS derniere_date
     FROM scrutins WHERE dossier_ref IS NOT NULL GROUP BY dossier_ref`
  )
  .all() as any[];
const dossiersIndex = dossiersRows.map((d) => {
  const scr = (dossierScrutinsQ.all(d.ref) as any[]).map((s) => {
    const positions: Record<string, string> = {};
    for (const p of posQ.all(s.uid) as any[]) positions[p.abrev] = p.position;
    return { uid: s.uid, numero: s.numero, date: s.date, titre: s.titre, objet: s.objet, sort_code: s.sort_code, nature: natureScrutin(s.objet, s.titre), positions };
  });
  const categorie = (catDossierQ.get(d.ref) as any)?.cat ?? null;
  write(`dossier/${d.ref}.json`, { ref: d.ref, titre: d.titre, categorie, scrutins: scr });
  return { ref: d.ref, titre: d.titre, categorie, nb_scrutins: d.nb_scrutins, derniere_date: d.derniere_date };
});
write("dossiers.json", dossiersIndex);
console.log(`  dossiers.json : ${dossiersIndex.length} dossiers + fichiers par dossier`);

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
function exporterDepute(uid: string) {
  const profils: Record<string, unknown> = {};
  for (const per of PERIODES) profils[per] = profilDepute(db, uid, per);
  const m = mandatStmt.get(uid) as any;
  const votes: Record<string, [string, string | null]> = {};
  for (const v of votesStmt.all(uid) as any[]) votes[v.scrutin_uid] = [v.position, v.consigne ?? null];
  write(`depute/${uid}.json`, {
    mandat_debut: m?.mandat_debut ?? null,
    mandat_fin: m?.mandat_fin ?? null,
    groupe_uid: m?.groupe_uid ?? null,
    profils,
    dissidences: dissidences(db, uid, 100),
    votes,
  });
}
let nd = 0;
for (const d of deputes as any[]) {
  exporterDepute(d.uid);
  if (++nd % 100 === 0) console.log(`  députés ${nd}/${deputes.length}`);
}

// 5 bis) Députés SORTIS en cours de législature (actif=0, cf. chargerDeputesSortis) :
// hors de l'index de recherche, mais leur fiche doit exister — les listes de votants
// des scrutins y mènent (sinon lien mort). Seuls ceux ayant réellement voté comptent.
const sortis = db
  .prepare(
    `SELECT d.uid FROM deputes d
     WHERE d.actif = 0 AND EXISTS (SELECT 1 FROM votes v WHERE v.depute_uid = d.uid)
     ORDER BY d.uid`
  )
  .all() as { uid: string }[];
for (const d of sortis) exporterDepute(d.uid);
if (sortis.length) console.log(`  + ${sortis.length} députés sortis en cours de législature`);

// 6) Amendements déposés sur le dossier : agrégat compact PAR DOSSIER, calculé une
//    seule fois puis rattaché à CHAQUE scrutin du dossier (pas de fichier par dossier →
//    on reste sous le plafond de fichiers de Cloudflare Pages, et aucune requête en plus).
//    On n'exporte JAMAIS d'amendements unitaires, seulement ces lignes agrégées.
const groupeInfo = new Map<string, { abrev: string | null; libelle: string; couleur: string | null }>(
  (db.prepare("SELECT uid, abrev, libelle, couleur FROM groupes").all() as any[]).map((g) => [
    g.uid,
    { abrev: g.abrev, libelle: g.libelle, couleur: g.couleur },
  ])
);
const amendLignes = db.prepare("SELECT * FROM dossier_amendements WHERE dossier = ?");
const amendTotaux = db.prepare("SELECT * FROM dossier_amendements_totaux WHERE dossier = ?");
const amendCache = new Map<string, any | null>();
function amendementsDuDossier(ref: string | null): any | null {
  if (!ref) return null;
  if (amendCache.has(ref)) return amendCache.get(ref);
  const tot = amendTotaux.get(ref) as any | undefined;
  if (!tot || !tot.total) {
    amendCache.set(ref, null);
    return null;
  }
  const rows = amendLignes.all(ref) as any[];
  const groupes: any[] = [];
  const institutionnels: any[] = [];
  for (const r of rows) {
    const compact = {
      total: r.total,
      adoptes: r.adoptes,
      rejetes: r.rejetes,
      tombes: r.tombes,
      retires: r.retires,
      irrecevables: r.irrecevables,
      articleTop: r.article_top ?? null,
      articleTopN: r.article_top_n ?? 0,
      articlesDistincts: r.articles_distincts ?? 0,
    };
    if (r.groupe === "__gouv__") institutionnels.push({ kind: "gouv", ...compact });
    else if (r.groupe === "__commission__") institutionnels.push({ kind: "commission", ...compact });
    else {
      const g = groupeInfo.get(r.groupe);
      if (!g) continue; // ref d'organe inconnue : déjà comptée dans le total, pas de ligne
      groupes.push({ groupe: r.groupe, abrev: g.abrev, libelle: g.libelle, couleur: g.couleur, ...compact });
    }
  }
  const out = {
    dossierRef: ref,
    total: tot.total,
    adoptes: tot.adoptes,
    nbGroupes: tot.nb_groupes,
    moyenne: tot.nb_groupes ? Math.round(tot.total_groupes / tot.nb_groupes) : 0,
    groupes,
    institutionnels,
  };
  amendCache.set(ref, out);
  return out;
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
  const amendements = amendementsDuDossier(detail.scrutin?.dossier_ref ?? null);
  write(`scrutin/${uid}.json`, { ...detail, amendements, votants });
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
