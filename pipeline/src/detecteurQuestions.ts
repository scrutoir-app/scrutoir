import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";

/**
 * Détecteur de questions pour le « test de proximité ». Tourne APRÈS ingest +
 * classify, lit le corpus complet (votes.db) et produit, par thème, une FILE DE
 * CANDIDATS scorée et dédoublonnée. Il ne rédige pas de thèses et ne décide pas
 * l'inclusion finale : il filtre, score, étiquette, et PRÉSERVE les décisions
 * humaines (these, statut) entre deux exécutions. Déterministe, idempotent.
 *
 * Sortie AUTORITATIVE : le Brain (fichier relu à la main, porteur des thèses et des
 * statuts validés → source de vérité). Surchargeable via QUESTIONS_OUT. Si le dossier
 * projet n'existe pas (ex. runner CI), l'étape est ignorée proprement : le chaînage dans
 * l'ingestion ne casse pas, et seuls les imports LOCAUX rafraîchissent le Brain.
 * Lancer : npm run detect-questions [-- <theme> ...].
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.QUESTIONS_OUT
  ? path.resolve(process.env.QUESTIONS_OUT)
  : "/Users/anthonyrousseau/Brain/01 - Projects/Scrutoir/questions";

const SIEGES_TOTAL = 577;

// Ordre gauche → droite (clé = abrev RÉEL en base). ⚠️ LFI-NFP / UDDPLR, pas LFI/UDR.
const ORDRE_HEMICYCLE = ["LFI-NFP", "GDR", "ECOS", "SOC", "LIOT", "DEM", "EPR", "HOR", "DR", "UDDPLR", "RN"];

// Quatre blocs pour la famille de clivage (jeu de départ éditable).
const BLOCS: Record<string, string[]> = {
  GAUCHE: ["LFI-NFP", "GDR", "ECOS", "SOC"],
  CENTRE: ["DEM", "EPR", "HOR", "LIOT"],
  DROITE: ["DR", "UDDPLR"],
  RN: ["RN"],
};

// --- Seuils (éditables) -----------------------------------------------------
const SEUIL_CLIVAGE = 0.15;       // sous ce clivage : quasi-unanime → rejeté
const MAJORITE_GROUPE = 0.6;      // > 60 % des exprimés du groupe = position nette, sinon "partagé"
const DOSSIER_DEBATTU = 10;       // un dossier avec ≥ N scrutins liés = texte très débattu (+0.1 importance)
const LISIBLE_MIN = 40;           // longueur de titre lisible (caractères)
const LISIBLE_MAX = 160;
const JARGON = ["ratification", "habilitation", "coordination", "transposition", "ordonnance"];

// Éligibilité : votes sur un texte ENTIER uniquement.
const ENSEMBLE = /^l['’]ensemble (du|de la|des) (projet|proposition)s? de loi/i;
const REJET =
  /amendement|sous-amendement|^l['’]article|article (premier|\d)|motion|renvoi en commission|question préalable|rejet préalable|crédits de la mission|seconde délibération|déclaration du gouvernement/i;

type Pos = "pour" | "contre" | "abstention" | "partagé";
const CODE: Record<string, string> = { pour: "P", contre: "C", abstention: "A", partagé: "X" };

interface ScrutinRow {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_code: string | null;
  type_vote: string | null;
  dossier_titre: string | null;
}

interface Candidat {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string;
  dossier_titre: string | null;
  scores: { clivage: number; couverture: number; importance: number; lisibilite: number };
  total: number;
  lisibilite_flag: boolean;
  famille_clivage: string;
  signature: string;
  positions_par_groupe: Record<string, Pos>;
}

const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** Position majoritaire d'un groupe sur un scrutin (nette si > 60 % des exprimés). */
function positionGroupe(c: { pour: number; contre: number; abstention: number }): Pos | null {
  const tot = c.pour + c.contre + c.abstention;
  if (tot === 0) return null; // groupe absent du scrutin
  const m = Math.max(c.pour, c.contre, c.abstention);
  if (m / tot > MAJORITE_GROUPE) {
    return c.pour === m ? "pour" : c.contre === m ? "contre" : "abstention";
  }
  return "partagé";
}

/** Position pondérée par sièges d'un bloc (argmax des sièges pour/contre/abstention). */
function positionBloc(membres: string[], posParAbrev: Map<string, Pos>, siegesParAbrev: Map<string, number>): Pos | null {
  const tally: Record<string, number> = { pour: 0, contre: 0, abstention: 0 };
  let total = 0;
  for (const abrev of membres) {
    const p = posParAbrev.get(abrev);
    if (!p || p === "partagé") continue;
    const s = siegesParAbrev.get(abrev) ?? 0;
    tally[p] += s;
    total += s;
  }
  if (total === 0) return "partagé";
  const best = Math.max(tally.pour, tally.contre, tally.abstention);
  const winners = (["pour", "contre", "abstention"] as const).filter((k) => tally[k] === best);
  return winners.length === 1 ? (winners[0] as Pos) : "partagé";
}

/**
 * Famille de clivage déterministe (première règle qui matche). Jeu de départ
 * éditable ; la signature brute permet de redériver d'autres familles. Important :
 * « consensus » dépend du CLIVAGE réel, pas du compte de blocs — un vote « gauche
 * seule contre le reste » est un clivage fort, pas un consensus.
 */
function familleClivage(bp: Record<string, Pos | null>, clivage: number): string {
  // 1) Quasi-accord réel uniquement (ces votes frôlent de toute façon le seuil de rejet).
  if (clivage < 0.25) return "consensus";

  const cote = (b: string) => (bp[b] === "pour" ? "P" : bp[b] === "contre" ? "C" : null); // côté tranché
  const g = cote("GAUCHE"), c = cote("CENTRE"), d = cote("DROITE"), r = cote("RN");

  // 2) Sinon, classer selon les blocs qui s'opposent.
  if (bp.CENTRE === "partagé") return "centre_fendu";

  // gauche + RN du même côté tranché, opposés au centre tranché
  if (g && r && g === r && c && c !== g) return "transpartisan";

  // RN isolé : seul de son côté tranché (aucun autre bloc avec lui), OU s'abstient
  // pendant que les autres tranchent ENSEMBLE (gauche+centre+droite unis).
  const rnSeul = !!r && g !== r && c !== r && d !== r;
  const rnAbstentionAutresUnis = bp.RN === "abstention" && !!g && g === c && c === d;
  if (rnSeul || rnAbstentionAutresUnis) return "RN_isolé";

  if (g) {
    const og = g === "P" ? "C" : "P"; // côté opposé à la gauche
    if (c === og && d === og && r === og) return "gauche_vs_reste"; // gauche seule contre tout le reste
    if (d === og && r === og) return "droite_RN_vs_gauche";         // droite + RN vs gauche, centre variable
    if (c === og && d === og && r !== og) return "gauche_vs_centre_droite"; // RN à part (abstention)
  }
  return "autre";
}

export function detecterQuestions(
  db: ReturnType<typeof openDb>,
  opts?: { themes?: string[] }
): Record<string, number> {
  // Garde : si le dossier projet (parent de OUT) n'existe pas — typiquement un runner CI
  // sous Linux où le Brain n'est pas monté — on ignore l'étape sans planter l'ingestion.
  const parentOut = path.dirname(OUT);
  if (!fs.existsSync(parentOut)) {
    console.log(`   (détecteur de questions ignoré : « ${parentOut} » introuvable)`);
    return {};
  }

  // Sièges par groupe (la table groupes n'a pas nb_deputes → on compte les élus actifs).
  const siegesParUid = new Map<string, number>();
  for (const row of db
    .prepare("SELECT groupe_uid g, COUNT(*) n FROM deputes WHERE actif = 1 AND groupe_uid IS NOT NULL GROUP BY groupe_uid")
    .all() as Array<{ g: string; n: number }>) {
    siegesParUid.set(row.g, row.n);
  }
  // abrev ↔ uid
  const abrevDeUid = new Map<string, string>();
  const uidDeAbrev = new Map<string, string>();
  for (const row of db.prepare("SELECT uid, abrev FROM groupes").all() as Array<{ uid: string; abrev: string | null }>) {
    if (row.abrev) {
      abrevDeUid.set(row.uid, row.abrev);
      uidDeAbrev.set(row.abrev, row.uid);
    }
  }
  const siegesParAbrev = new Map<string, number>();
  for (const abrev of ORDRE_HEMICYCLE) {
    const uid = uidDeAbrev.get(abrev);
    if (uid) siegesParAbrev.set(abrev, siegesParUid.get(uid) ?? 0);
  }

  // Scrutins liés par dossier (pour l'importance : texte très débattu).
  const scrutinsParDossier = new Map<string, number>();
  for (const row of db
    .prepare("SELECT dossier_titre d, COUNT(*) n FROM scrutins WHERE dossier_titre IS NOT NULL GROUP BY dossier_titre")
    .all() as Array<{ d: string; n: number }>) {
    scrutinsParDossier.set(row.d, row.n);
  }

  // 1) FILTRE D'ÉLIGIBILITÉ — votes sur un texte entier uniquement.
  const tous = db
    .prepare("SELECT uid, numero, date, titre, objet, sort_code, type_vote, dossier_titre FROM scrutins")
    .all() as ScrutinRow[];
  const eligibles = tous.filter((s) => {
    const titre = s.titre ?? "";
    if (REJET.test(titre)) return false;
    return s.type_vote === "scrutin public solennel" || ENSEMBLE.test(titre);
  });

  // 2) VENTILATION PAR GROUPE — comptes pour/contre/abstention par scrutin éligible.
  db.exec("CREATE TEMP TABLE IF NOT EXISTS _elig (uid TEXT PRIMARY KEY)");
  db.exec("DELETE FROM _elig");
  const insElig = db.prepare("INSERT OR IGNORE INTO _elig (uid) VALUES (?)");
  db.transaction(() => eligibles.forEach((s) => insElig.run(s.uid)))();

  // comptes[scrutin][groupe_uid] = { pour, contre, abstention }
  const comptes = new Map<string, Map<string, { pour: number; contre: number; abstention: number }>>();
  for (const row of db
    .prepare(
      `SELECT v.scrutin_uid s, d.groupe_uid g, v.position p, COUNT(*) n
       FROM votes v
       JOIN deputes d ON d.uid = v.depute_uid
       JOIN _elig e ON e.uid = v.scrutin_uid
       WHERE v.position IN ('pour','contre','abstention') AND d.groupe_uid IS NOT NULL
       GROUP BY v.scrutin_uid, d.groupe_uid, v.position`
    )
    .all() as Array<{ s: string; g: string; p: "pour" | "contre" | "abstention"; n: number }>) {
    let parGroupe = comptes.get(row.s);
    if (!parGroupe) { parGroupe = new Map(); comptes.set(row.s, parGroupe); }
    let c = parGroupe.get(row.g);
    if (!c) { c = { pour: 0, contre: 0, abstention: 0 }; parGroupe.set(row.g, c); }
    c[row.p] = row.n;
  }

  // 3) SCORES + signature + famille, rejet si clivage trop faible.
  const scored: Candidat[] = [];
  for (const s of eligibles) {
    const parGroupe = comptes.get(s.uid);
    if (!parGroupe) continue; // aucun vote nominatif exploitable

    // Position de chaque groupe (par uid) + P/C en sièges.
    const posParUid = new Map<string, Pos>();
    let P = 0, C = 0;
    for (const [guid, c] of parGroupe) {
      const p = positionGroupe(c);
      if (!p) continue;
      posParUid.set(guid, p);
      if (p === "pour") P += siegesParUid.get(guid) ?? 0;
      else if (p === "contre") C += siegesParUid.get(guid) ?? 0;
    }

    const clivage = P + C > 0 ? 1 - Math.abs(P - C) / (P + C) : 0;
    if (clivage < SEUIL_CLIVAGE) continue; // quasi-unanime → inutile pour le test

    const couverture = (P + C) / SIEGES_TOTAL;
    const solennel = s.type_vote === "scrutin public solennel";
    const debattu = s.dossier_titre ? (scrutinsParDossier.get(s.dossier_titre) ?? 0) >= DOSSIER_DEBATTU : false;
    const importance = Math.min(1, (solennel ? 1.0 : 0.7) + (debattu ? 0.1 : 0));

    const titre = s.titre ?? "";
    const lisible = titre.length >= LISIBLE_MIN && titre.length <= LISIBLE_MAX && !JARGON.some((j) => titre.toLowerCase().includes(j));
    const lisibilite = lisible ? 1 : 0.5;

    const total = 0.45 * clivage + 0.3 * couverture + 0.2 * importance + 0.05 * lisibilite;

    // Signature (11 groupes dans l'ordre) + positions par abrev + positions de blocs.
    const posParAbrev = new Map<string, Pos>();
    const positions_par_groupe: Record<string, Pos> = {};
    let signature = "";
    for (const abrev of ORDRE_HEMICYCLE) {
      const uid = uidDeAbrev.get(abrev);
      const p = uid ? posParUid.get(uid) : undefined;
      signature += p ? CODE[p] : "-";
      if (p) { posParAbrev.set(abrev, p); positions_par_groupe[abrev] = p; }
    }
    const bp: Record<string, Pos | null> = {};
    for (const bloc of Object.keys(BLOCS)) bp[bloc] = positionBloc(BLOCS[bloc], posParAbrev, siegesParAbrev);

    scored.push({
      uid: s.uid,
      numero: s.numero,
      date: s.date,
      titre,
      dossier_titre: s.dossier_titre,
      scores: { clivage: r4(clivage), couverture: r4(couverture), importance: r4(importance), lisibilite },
      total: r4(total),
      lisibilite_flag: !lisible,
      famille_clivage: familleClivage(bp, clivage),
      signature,
      positions_par_groupe,
    });
  }

  // 4) DÉDUPLICATION PAR DOSSIER — un texte = une question. On garde le vote d'ensemble
  // de la DERNIÈRE LECTURE (date la plus récente) : c'est la décision réelle du texte, et
  // c'est ce qu'on veut comme « question » (ex. ArcelorMittal → 2e lecture, pas la 1re).
  // Le total ne sert que de départage à date égale.
  const meilleur = (a: Candidat, b: Candidat): Candidat => {
    if ((a.date ?? "") !== (b.date ?? "")) return (a.date ?? "") > (b.date ?? "") ? a : b; // dernière lecture
    if (a.total !== b.total) return a.total > b.total ? a : b;
    if ((a.numero ?? 0) !== (b.numero ?? 0)) return (a.numero ?? 0) > (b.numero ?? 0) ? a : b;
    return a.uid > b.uid ? a : b; // tie-break stable
  };
  const parDossier = new Map<string, Candidat>();
  for (const c of scored) {
    const cle = c.dossier_titre ? `D:${c.dossier_titre}` : `U:${c.uid}`; // dossier null = jamais fusionné
    const cur = parDossier.get(cle);
    parDossier.set(cle, cur ? meilleur(cur, c) : c);
  }
  const retenus = [...parDossier.values()];

  // 5) RÉPARTITION PAR THÈME (un scrutin multi-thèmes va dans chacune de ses cats).
  const catsParScrutin = new Map<string, string[]>();
  for (const row of db.prepare("SELECT scrutin_uid s, categorie_id c FROM scrutin_categories").all() as Array<{ s: string; c: string }>) {
    const arr = catsParScrutin.get(row.s) ?? [];
    arr.push(row.c);
    catsParScrutin.set(row.s, arr);
  }
  const parTheme = new Map<string, Candidat[]>();
  for (const c of retenus) {
    for (const cat of catsParScrutin.get(c.uid) ?? []) {
      const arr = parTheme.get(cat) ?? [];
      arr.push(c);
      parTheme.set(cat, arr);
    }
  }

  // 6) + 7) ÉCRITURE avec préservation des décisions humaines (merge).
  // Filtre optionnel de thèmes (1er run = « economie » seul) ; sinon tous.
  const filtre = opts?.themes?.length ? new Set(opts.themes) : null;
  fs.mkdirSync(OUT, { recursive: true });
  const resultats: Record<string, number> = {};
  for (const [cat, liste] of parTheme) {
    if (filtre && !filtre.has(cat)) continue;
    liste.sort((a, b) => b.total - a.total || (b.date ?? "").localeCompare(a.date ?? "") || a.uid.localeCompare(b.uid));

    const fichier = path.join(OUT, `${cat}.json`);
    const existantParUid = new Map<string, any>();
    if (fs.existsSync(fichier)) {
      try {
        for (const o of JSON.parse(fs.readFileSync(fichier, "utf8")) as any[]) existantParUid.set(o.uid, o);
      } catch { /* fichier illisible : on repart de zéro pour ce thème */ }
    }

    const out: any[] = [];
    const vus = new Set<string>();
    for (const c of liste) {
      const prev = existantParUid.get(c.uid);
      out.push({
        ...c,
        these: prev ? prev.these ?? null : null,               // édité main → préservé
        statut: prev ? prev.statut ?? "candidat" : "candidat", // candidat|valide|rejete
        nouveau: !prev,                                         // absent du fichier précédent
      });
      vus.add(c.uid);
    }
    // Ne jamais perdre une décision humaine : on conserve les entrées déjà tranchées
    // (validées/rejetées ou avec thèse) même si elles ne sont plus candidates.
    for (const [uid, prev] of existantParUid) {
      if (vus.has(uid)) continue;
      const tranchee = (prev.statut && prev.statut !== "candidat") || prev.these != null;
      if (tranchee) out.push({ ...prev, nouveau: false });
    }
    out.sort((a, b) => b.total - a.total || (b.date ?? "").localeCompare(a.date ?? "") || a.uid.localeCompare(b.uid));

    fs.writeFileSync(fichier, JSON.stringify(out, null, 2));
    resultats[cat] = out.length;
  }

  return resultats;
}

// Exécution directe (npm run detect-questions [-- <theme> ...]) : lançable seul, sans
// effet de bord à l'import (le pipeline appelle detecterQuestions() après classify).
if (import.meta.url === `file://${process.argv[1]}`) {
  const themes = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const db = openDb();
  try {
    const res = detecterQuestions(db, themes.length ? { themes } : undefined);
    const ecrits = Object.keys(res).sort();
    console.log(`✅ Questions détectées → ${OUT}`);
    for (const t of ecrits) {
      console.log(`   ${t} : ${res[t]} candidats`);
      // Contrôle : les 5 premiers titres (par total décroissant) du thème écrit.
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(OUT, `${t}.json`), "utf8")) as any[];
        arr.slice(0, 5).forEach((c, i) => console.log(`       ${i + 1}. [${c.total.toFixed(3)}] ${c.titre}`));
      } catch { /* lecture best-effort */ }
    }
    const total = Object.values(res).reduce((s, n) => s + n, 0);
    console.log(`   (${total} lignes au total sur ${ecrits.length} thème(s))`);
  } finally {
    db.close();
  }
}
