import type Database from "better-sqlite3";

/**
 * Pré-calcul du « shuffle » de la confrontation : trois viviers de paires de
 * députés, chacun porteur d'une surprise (le hasard pur opposerait une figure
 * d'extrême gauche à une d'extrême droite — résultat connu d'avance, sans valeur).
 *
 *  1. fracture_interne       — même groupe, votes les plus ÉLOIGNÉS (taux le plus bas).
 *  2. alliance_contre_nature — groupes OPPOSÉS, votes anormalement proches (taux le plus haut).
 *  3. faux_duel              — deux groupes différents autour de 50 % (|taux − 0.5| le plus petit).
 *
 * Deux garde-fous non négociables :
 *  - Plancher d'échantillon (SEUIL_COMMUNS) : sous ce seuil le taux est du bruit,
 *    pas une révélation. Sans lui les « alliances » ne sont que des artefacts.
 *  - Notoriété : alliance_contre_nature et faux_duel sont restreints à un pool de
 *    députés reconnaissables (présidents de groupe + plus forte participation).
 *    Proxy imparfait, assumé comme tel — pas une vraie mesure de notoriété.
 *    fracture_interne tourne sur toutes les paires intra-groupe (volume faible).
 *
 * On ne stocke que les TOP_PAR_ANGLE meilleurs candidats par angle, jamais toute
 * la matrice (~166 000 paires). L'optimisation : intra-groupe pour l'angle 1
 * (~20 000 paires), pool notable seul pour les angles 2 et 3 (~6 000 paires).
 */

export type AngleShuffle = "fracture_interne" | "alliance_contre_nature" | "faux_duel";

// Plancher de scrutins communs par paire. Sous ce seuil, le taux d'accord est du
// bruit statistique. À remonter si les paires « contre-nature » s'avèrent être des
// artefacts de faible échantillon (cf. DEFINITION OF DONE).
const SEUIL_COMMUNS = 30;

// Taille du pool de notoriété (plus forte participation), auquel on ajoute les
// présidents de groupe. Proxy de « députés reconnaissables ».
const TAILLE_POOL = 110;

// Nombre de candidats conservés par angle (on jette le reste de la matrice).
const TOP_PAR_ANGLE = 60;

// Deux groupes sont « opposés » si leurs consignes de vote concordent sur moins de
// ce seuil de scrutins (votent différemment plus d'une fois sur deux). Mesure
// EMPIRIQUE (à partir des positions de groupe), pas un axe gauche-droite codé en
// dur — cohérent avec la neutralité de Scrutoir. Calibré sur données réelles : à
// 0.45 le vivier se réduisait à un seul votant atypique ; 0.55 ouvre à tous les
// couples réellement clivés (gauche/centre, droite/centre, RN/divers) sans bruit.
const SEUIL_GROUPES_OPPOSES = 0.55;
const MIN_BASE_GROUPES = 40; // scrutins communs minimum pour juger deux groupes

// alliance_contre_nature : la surprise n'est pas le taux absolu (deux groupes
// opposés dépassent rarement ~55 %), mais l'ÉCART à ce que font leurs groupes.
// On exige un accord au moins égal à un pile-ou-face ET un excès net sur la ligne
// attendue des deux groupes — sinon « 52 % » n'étonne personne.
const MIN_TAUX_ALLIANCE = 0.5;
const MIN_EXCES_ALLIANCE = 0.1; // points d'accord au-dessus de la ligne des groupes

// Un même député ne peut pas monopoliser un angle : sans ça, un votant atypique
// truste tout le vivier et le shuffle resservirait toujours la même tête.
const MAX_PAR_DEPUTE = 3;

interface Candidat {
  a: string;
  b: string;
  communs: number;
  accords: number;
  taux: number;
  exces?: number; // alliance : écart à la ligne attendue des deux groupes
}

type CarteVotes = Map<string, Map<string, string>>; // depute_uid -> (scrutin_uid -> position)

/** Accord entre deux députés sur leurs scrutins nominatifs communs. */
function comparer(a: string, b: string, votes: CarteVotes): { communs: number; accords: number } | null {
  const ma = votes.get(a);
  const mb = votes.get(b);
  if (!ma || !mb) return null;
  // On parcourt le plus petit des deux ensembles.
  const [petit, grand] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
  let communs = 0;
  let accords = 0;
  for (const [scrutin, pos] of petit) {
    const autre = grand.get(scrutin);
    if (autre !== undefined) {
      communs++;
      if (autre === pos) accords++;
    }
  }
  return { communs, accords };
}

export function calculerShuffleConfrontation(db: Database.Database): Record<AngleShuffle, number> {
  // Groupes « non-partis » à exclure : les non-inscrits (NI) ne forment pas un parti
  // mais un fourre-tout — une « fracture interne » entre eux n'expose aucune tension
  // de parti, et ils ne sont pas des ancres de notoriété pertinentes.
  const nonPartis = new Set(
    (db.prepare("SELECT uid, abrev, libelle FROM groupes").all() as Array<{ uid: string; abrev: string | null; libelle: string }>)
      .filter((g) => g.abrev === "NI" || /non.?inscrit/i.test(g.libelle))
      .map((g) => g.uid)
  );

  // 1) Députés actifs (groupe, participation, qualité), hors non-partis
  const deputes = (db
    .prepare(
      `SELECT uid, groupe_uid, participation_rate, qualite
       FROM deputes WHERE actif = 1 AND groupe_uid IS NOT NULL`
    )
    .all() as Array<{ uid: string; groupe_uid: string; participation_rate: number | null; qualite: string | null }>)
    .filter((d) => !nonPartis.has(d.groupe_uid));
  const groupeDe = new Map(deputes.map((d) => [d.uid, d.groupe_uid]));

  // 2) Votes nominatifs exprimés, par député (pour/contre/abstention uniquement —
  //    mêmes règles que confrontation() : un silence n'est pas un désaccord).
  //    On se RESTREINT aux scrutins classés dans un thème : c'est exactement le
  //    périmètre de confrontation() (qui regroupe par catégorie), donc le taux et
  //    le nombre de communs ici collent à la synthèse affichée à l'écran.
  const votes: CarteVotes = new Map();
  const stmt = db.prepare(
    `SELECT depute_uid, scrutin_uid, position FROM votes
     WHERE position IN ('pour','contre','abstention')
       AND scrutin_uid IN (SELECT DISTINCT scrutin_uid FROM scrutin_categories)`
  );
  for (const r of stmt.iterate() as Iterable<{ depute_uid: string; scrutin_uid: string; position: string }>) {
    let m = votes.get(r.depute_uid);
    if (!m) {
      m = new Map();
      votes.set(r.depute_uid, m);
    }
    m.set(r.scrutin_uid, r.position);
  }

  // 3) Couples de groupes « opposés » : consignes de groupe qui concordent rarement.
  const posGroupe = new Map<string, Map<string, string>>(); // groupe_uid -> (scrutin -> position)
  for (const r of db
    .prepare(`SELECT groupe_uid, scrutin_uid, position FROM groupe_positions WHERE position IS NOT NULL`)
    .all() as Array<{ groupe_uid: string; scrutin_uid: string; position: string }>) {
    let m = posGroupe.get(r.groupe_uid);
    if (!m) {
      m = new Map();
      posGroupe.set(r.groupe_uid, m);
    }
    m.set(r.scrutin_uid, r.position);
  }
  const opposes = new Set<string>(); // clé "g1|g2" (g1 < g2)
  const ligneGroupes = new Map<string, number>(); // "g1|g2" -> taux d'accord des consignes
  const groupes = [...posGroupe.keys()];
  for (let i = 0; i < groupes.length; i++) {
    for (let j = i + 1; j < groupes.length; j++) {
      const r = comparer2(posGroupe.get(groupes[i])!, posGroupe.get(groupes[j])!);
      if (r.communs < MIN_BASE_GROUPES) continue;
      const [g1, g2] = [groupes[i], groupes[j]].sort();
      const taux = r.accords / r.communs;
      ligneGroupes.set(`${g1}|${g2}`, taux);
      if (taux < SEUIL_GROUPES_OPPOSES) opposes.add(`${g1}|${g2}`);
    }
  }
  const cleGroupes = (a: string, b: string): string | null => {
    const ga = groupeDe.get(a);
    const gb = groupeDe.get(b);
    if (!ga || !gb || ga === gb) return null;
    const [g1, g2] = [ga, gb].sort();
    return `${g1}|${g2}`;
  };
  const groupesOpposes = (a: string, b: string) => {
    const k = cleGroupes(a, b);
    return k != null && opposes.has(k);
  };

  // 4) Pool de notoriété : plus forte participation + présidents de groupe.
  const triParticipation = deputes
    .filter((d) => d.participation_rate != null)
    .sort((a, b) => (b.participation_rate ?? 0) - (a.participation_rate ?? 0));
  const pool = new Set<string>(triParticipation.slice(0, TAILLE_POOL).map((d) => d.uid));
  for (const d of deputes) if (d.qualite === "Président") pool.add(d.uid);

  // --- Angle 1 : fracture interne (toutes les paires intra-groupe) ---
  const parGroupe = new Map<string, string[]>();
  for (const d of deputes) {
    const arr = parGroupe.get(d.groupe_uid) ?? [];
    arr.push(d.uid);
    parGroupe.set(d.groupe_uid, arr);
  }
  const fracture: Candidat[] = [];
  for (const membres of parGroupe.values()) {
    for (let i = 0; i < membres.length; i++) {
      for (let j = i + 1; j < membres.length; j++) {
        const r = comparer(membres[i], membres[j], votes);
        if (r && r.communs >= SEUIL_COMMUNS) {
          fracture.push({ a: membres[i], b: membres[j], communs: r.communs, accords: r.accords, taux: r.accords / r.communs });
        }
      }
    }
  }

  // --- Angles 2 & 3 : paires du pool notable (calcul partagé) ---
  const notables = [...pool];
  const alliance: Candidat[] = [];
  const faux: Candidat[] = [];
  for (let i = 0; i < notables.length; i++) {
    for (let j = i + 1; j < notables.length; j++) {
      const a = notables[i];
      const b = notables[j];
      const memeGroupe = groupeDe.get(a) === groupeDe.get(b);
      if (memeGroupe) continue; // angles 2 & 3 : inter-groupes
      const r = comparer(a, b, votes);
      if (!r || r.communs < SEUIL_COMMUNS) continue;
      const taux = r.accords / r.communs;
      const c: Candidat = { a, b, communs: r.communs, accords: r.accords, taux };
      // alliance : groupes opposés ET accord nettement au-dessus de leur ligne.
      if (taux >= MIN_TAUX_ALLIANCE && groupesOpposes(a, b)) {
        const ligne = ligneGroupes.get(cleGroupes(a, b)!);
        if (ligne != null && taux - ligne >= MIN_EXCES_ALLIANCE) {
          alliance.push({ ...c, exces: taux - ligne });
        }
      }
      faux.push(c);
    }
  }

  // Tri par angle (on ne garde que le haut du panier, avec un plafond par député).
  fracture.sort((x, y) => x.taux - y.taux); // plus divergents d'abord
  alliance.sort((x, y) => (y.exces ?? 0) - (x.exces ?? 0)); // plus loin de leur ligne d'abord
  faux.sort((x, y) => Math.abs(x.taux - 0.5) - Math.abs(y.taux - 0.5)); // plus proches de 50 %

  const ecrire = db.transaction((angle: AngleShuffle, liste: Candidat[]) => {
    db.prepare("DELETE FROM confrontation_shuffle WHERE angle = ?").run(angle);
    const ins = db.prepare(
      `INSERT OR IGNORE INTO confrontation_shuffle (angle, a_uid, b_uid, communs, accords, taux, rang)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const retenus = diversifier(liste, TOP_PAR_ANGLE);
    retenus.forEach((c, k) => {
      const [a, b] = [c.a, c.b].sort(); // ordre canonique (paire non orientée)
      ins.run(angle, a, b, c.communs, c.accords, c.taux, k + 1);
    });
    return retenus.length;
  });
  const nFracture = ecrire("fracture_interne", fracture);
  const nAlliance = ecrire("alliance_contre_nature", alliance);
  const nFaux = ecrire("faux_duel", faux);

  return {
    fracture_interne: nFracture,
    alliance_contre_nature: nAlliance,
    faux_duel: nFaux,
  };
}

/**
 * Garde le haut d'une liste triée en limitant la récurrence d'un même député
 * (MAX_PAR_DEPUTE), pour que le vivier ne soit pas monopolisé par un seul votant
 * atypique — le shuffle resservirait sinon toujours la même tête.
 */
function diversifier(liste: Candidat[], max: number): Candidat[] {
  const compte = new Map<string, number>();
  const out: Candidat[] = [];
  for (const c of liste) {
    if (out.length >= max) break;
    const na = compte.get(c.a) ?? 0;
    const nb = compte.get(c.b) ?? 0;
    if (na >= MAX_PAR_DEPUTE || nb >= MAX_PAR_DEPUTE) continue;
    out.push(c);
    compte.set(c.a, na + 1);
    compte.set(c.b, nb + 1);
  }
  return out;
}

/** Accord entre deux cartes scrutin→position (réutilisé pour les consignes de groupe). */
function comparer2(ma: Map<string, string>, mb: Map<string, string>): { communs: number; accords: number } {
  const [petit, grand] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
  let communs = 0;
  let accords = 0;
  for (const [scrutin, pos] of petit) {
    const autre = grand.get(scrutin);
    if (autre !== undefined) {
      communs++;
      if (autre === pos) accords++;
    }
  }
  return { communs, accords };
}
