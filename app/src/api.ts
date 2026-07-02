import type {
  ProfilDepute, DetailScrutin, DeputeResume, ScrutinResume, Periode, CategorieRef, Dissidence, Votant, VoteScrutin,
  PartiResume, ProfilParti, Confrontation, Departement, VoteSuivi, ShuffleConfrontation, AngleShuffle,
} from "./types";
import type { QuestionProximite } from "./testProximite/score";
import { normaliser } from "./search/normalize";
import { ALIAS_PARTIS } from "./search/aliases";

/**
 * Couche données « tout statique » : l'app lit des fichiers JSON pré-générés
 * (pipeline `export:static`) au lieu d'une API serveur. En dev (Expo web) et en
 * prod (Cloudflare Pages), ils sont servis en même origine sous /data/. Pour le
 * natif (plus tard), définir EXPO_PUBLIC_DATA_BASE = URL du CDN.
 * La confrontation, la recherche et les drill-downs sont calculés côté client à
 * partir d'index légers (deputes, scrutins) + fichiers par élu / par scrutin.
 */
const DATA_BASE = process.env.EXPO_PUBLIC_DATA_BASE ?? "";

const cache = new Map<string, Promise<any>>();
function j<T>(rel: string): Promise<T> {
  let p = cache.get(rel);
  if (!p) {
    p = fetch(`${DATA_BASE}/data/${rel}.json`).then((r) => {
      if (!r.ok) throw new Error(`data ${r.status} : ${rel}`);
      return r.json();
    });
    cache.set(rel, p);
    // Ne JAMAIS figer un échec en cache : une coupure réseau passagère rendrait
    // la ressource définitivement inaccessible jusqu'au rechargement de la page.
    p.catch(() => {
      if (cache.get(rel) === p) cache.delete(rel);
    });
  }
  return p as Promise<T>;
}

// --- Index (chargés une fois, mis en cache) ---------------------------------
// `categorie` = catégorie principale (picto, confrontation) ; `cats` = toutes les
// catégories du scrutin (appartenance à un thème : un scrutin peut en avoir plusieurs).
type ScrutinIdx = ScrutinResume & { cats?: string[] };
const deputesIndex = () => j<DeputeResume[]>("deputes");
const scrutinsIndex = () => j<ScrutinIdx[]>("scrutins");
let scrMapP: Promise<Map<string, ScrutinIdx>> | null = null;
function scrutinsMap() {
  if (!scrMapP) {
    scrMapP = scrutinsIndex().then((l) => new Map(l.map((s) => [s.uid, s])));
    scrMapP.catch(() => {
      scrMapP = null; // même règle que `j()` : pas d'échec figé en cache
    });
  }
  return scrMapP;
}
const inCat = (s: ScrutinIdx, id: string) => (s.cats?.length ? s.cats.includes(id) : s.categorie === id);
interface DeputeFile {
  mandat_debut: string | null;
  mandat_fin: string | null;
  groupe_uid: string | null;
  profils: Record<Periode, ProfilDepute>;
  dissidences: Dissidence[];
  votes: Record<string, [string, string | null]>; // scrutin_uid -> [position, consigne]
}
const depute = (uid: string) => j<DeputeFile>(`depute/${uid}`);

// --- Helpers (portés du backend) --------------------------------------------
function bornePeriode(p: Periode): string | null {
  if (p === "all") return null;
  const d = new Date();
  d.setMonth(d.getMonth() - (p === "12m" ? 12 : 6));
  return d.toISOString().slice(0, 10);
}
const EXPRIME = (pos: string) => pos === "pour" || pos === "contre" || pos === "abstention";

// Normalisation + alias de partis partagés avec la recherche sémantique (src/search).
const norm = normaliser;

// --- Référentiels directs ---------------------------------------------------
export const getCategories = () => j<CategorieRef[]>("categories");
export const getGrandsScrutins = () => j<ScrutinResume[]>("grands");
/**
 * Scrutins les plus récents, TOUS SUJETS CONFONDUS, en chronologique inverse.
 * Alimente la vue « Récents » de l'onglet Scrutins (consultation globale de retour).
 * Pas de nouvel export pipeline : on relit l'index `scrutins.json` déjà chargé pour la
 * recherche (déjà trié par date desc ; on re-trie par sécurité). `limit` borne la liste
 * (l'index complet peut être volumineux ; la vue garde son propre filtre par date).
 */
export async function getScrutinsRecents(limit = 250): Promise<ScrutinResume[]> {
  const scrs = await scrutinsIndex();
  return [...scrs]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (b.numero ?? 0) - (a.numero ?? 0))
    .slice(0, limit);
}
// Test de proximité : questions validées + totaux (compilé par `npm run build-test-data`).
export const getTestProximite = () => j<QuestionProximite[]>("test-proximite");

/**
 * Fraîcheur des données : `version.json` est régénéré à chaque export statique
 * (cron quotidien après ré-ingestion AN + à chaque déploiement). `generatedAt` est
 * donc une VRAIE date de mise à jour des données publiées (jamais codée en dur).
 * Lu sans cache pour rester à jour. Renvoie `null` si la source est indisponible.
 */
export interface Meta { ingestedAt: string | null }
export async function getMeta(): Promise<Meta> {
  try {
    const res = await fetch(`${DATA_BASE}/data/version.json`, { cache: "no-store" });
    if (!res.ok) return { ingestedAt: null };
    const v = (await res.json()) as { generatedAt?: unknown };
    return { ingestedAt: typeof v?.generatedAt === "string" ? v.generatedAt : null };
  } catch {
    return { ingestedAt: null };
  }
}
export const getPartis = () => j<PartiResume[]>("partis");
export const getProfil = (uid: string, periode: Periode) => depute(uid).then((d) => d.profils[periode]);
export const getScrutin = (uid: string) => j<DetailScrutin>(`scrutin/${uid}`);
export const getDissidences = (uid: string) => depute(uid).then((d) => d.dissidences);
/**
 * Votes bruts d'un élu : { scrutin_uid: position }. Sert au test de proximité pour
 * comparer le « je » de l'utilisateur au vote INDIVIDUEL du député (la question du test
 * porte le n° de scrutin → uid = `VTANR5L17V<id>`). Réutilise le fichier élu déjà mis en
 * cache (aucun appel réseau supplémentaire quand la fiche / le feed l'ont déjà chargé).
 */
export const getVotesBruts = (uid: string): Promise<Record<string, string>> =>
  depute(uid).then((d) =>
    Object.fromEntries(
      Object.entries(d.votes || {}).map(([su, t]) => [su, Array.isArray(t) ? t[0] : (t as unknown as string)])
    )
  );
export const getParti = (uid: string, periode: Periode) =>
  j<Record<Periode, ProfilParti>>(`parti/${uid}`).then((p) => p[periode]);

// --- Recherche (client) -----------------------------------------------------
export async function rechercher(q: string): Promise<{ deputes: DeputeResume[]; scrutins: ScrutinResume[] }> {
  const s = norm(q);
  if (s.length < 2) return { deputes: [], scrutins: [] };
  const [deps, scrs] = await Promise.all([deputesIndex(), scrutinsIndex()]);
  const alias = ALIAS_PARTIS[s] ?? null;
  const deputes = deps
    .filter((d) => {
      const sigle = (d.abrev ?? "").toLowerCase();
      return (
        norm(d.nom_complet).includes(s) ||
        sigle === s ||
        norm(d.groupe ?? "").includes(s) ||
        (alias != null && d.abrev === alias)
      );
    })
    .slice(0, 250);
  const scrutins = scrs.filter((sc) => norm(sc.titre ?? "").includes(s)).slice(0, 15);
  return { deputes, scrutins };
}

// --- Mon député (client) ----------------------------------------------------
/**
 * Feed de l'onglet Suivis : pour les élus suivis, leurs votes nominatifs
 * (pour/contre/abstention/nonvotant) les plus récents, fusionnés et triés par date.
 * Tout est calculé côté client depuis les fichiers statiques (aucun serveur).
 */
export async function getVotesSuivis(uids: string[], limit = 80): Promise<VoteSuivi[]> {
  if (!uids.length) return [];
  const [deps, scrMap] = await Promise.all([deputesIndex(), scrutinsMap()]);
  const depByUid = new Map(deps.map((d) => [d.uid, d]));
  const profils = await Promise.all(uids.map((u) => depute(u).catch(() => null)));
  const items: VoteSuivi[] = [];
  uids.forEach((u, i) => {
    const prof = profils[i];
    if (!prof) return;
    const dep = depByUid.get(u);
    for (const [scrUid, tuple] of Object.entries(prof.votes || {})) {
      const sc = scrMap.get(scrUid);
      if (!sc) continue;
      items.push({
        deputeUid: u,
        nom: dep?.nom_complet ?? "",
        photo: dep?.photo_url ?? null,
        abrev: dep?.abrev ?? null,
        couleur: dep?.couleur ?? null,
        scrutinUid: scrUid,
        titre: sc.titre ?? null,
        date: sc.date ?? null,
        numero: sc.numero ?? null,
        position: Array.isArray(tuple) ? tuple[0] : (tuple as unknown as string),
        sort_code: sc.sort_code ?? null,
        categorie: sc.categorie ?? null,
      });
    }
  });
  items.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero ?? 0) - (a.numero ?? 0));
  return items.slice(0, limit);
}

/**
 * Feed des PARTIS suivis : positions majoritaires les plus récentes des groupes suivis,
 * remises dans la même forme que les votes d'élus (VoteSuivi) pour fusionner le fil
 * d'accueil. `deputeUid` porte l'uid du parti (PO…) → la carte sait router vers la fiche.
 */
export async function getVotesPartisSuivis(partiUids: string[], limit = 80): Promise<VoteSuivi[]> {
  if (!partiUids.length) return [];
  const [partis, scrMap] = await Promise.all([getPartis(), scrutinsMap()]);
  const byUid = new Map(partis.map((p) => [p.uid, p]));
  const positions = await Promise.all(partiUids.map((u) => groupePositions(u).catch(() => ({} as Record<string, string>))));
  const items: VoteSuivi[] = [];
  partiUids.forEach((u, i) => {
    const p = byUid.get(u);
    if (!p) return;
    for (const [scrUid, pos] of Object.entries(positions[i])) {
      const sc = scrMap.get(scrUid);
      if (!sc) continue;
      items.push({
        deputeUid: u,
        nom: p.libelle,
        photo: null,
        abrev: p.abrev,
        couleur: p.couleur,
        scrutinUid: scrUid,
        titre: sc.titre ?? null,
        date: sc.date ?? null,
        numero: sc.numero ?? null,
        position: pos,
        sort_code: sc.sort_code ?? null,
        categorie: sc.categorie ?? null,
      });
    }
  });
  items.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero ?? 0) - (a.numero ?? 0));
  return items.slice(0, limit);
}

/** Tous les élus actifs d'un groupe (pour la liste « élus du parti »), triés par nom. */
export async function getDeputesParti(groupeUid: string): Promise<DeputeResume[]> {
  const deps = await deputesIndex();
  return deps
    .filter((d) => d.groupe_uid === groupeUid)
    .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"));
}

/** Résout des scrutins (index léger) à partir d'uids, dans l'ORDRE des uids fournis
 *  (utilisé par la fusion sémantique : l'ordre = le classement par pertinence). */
export async function getScrutinsParUids(uids: string[]): Promise<ScrutinResume[]> {
  if (!uids.length) return [];
  const map = await scrutinsMap();
  return uids.map((u) => map.get(u)).filter(Boolean) as ScrutinResume[];
}

/** Résout des fiches-résumé de députés à partir d'une liste d'uids (élus suivis). */
export async function getDeputesByUids(uids: string[]): Promise<DeputeResume[]> {
  if (!uids.length) return [];
  const deps = await deputesIndex();
  const byUid = new Map(deps.map((d) => [d.uid, d]));
  return uids.map((u) => byUid.get(u)).filter(Boolean) as DeputeResume[];
}

export async function getDepartements(): Promise<Departement[]> {
  const deps = await deputesIndex();
  const map = new Map<string, { num: string; nom: string; circos: number }>();
  for (const d of deps) {
    if (!d.num_departement) continue;
    const e = map.get(d.num_departement) ?? { num: d.num_departement, nom: d.departement ?? "", circos: 0 };
    e.circos++;
    map.set(d.num_departement, e);
  }
  return [...map.values()].sort((a, b) => (parseInt(a.num) || 999) - (parseInt(b.num) || 999) || a.num.localeCompare(b.num));
}
export async function getCirconscription(dept: string, circo?: string): Promise<DeputeResume[]> {
  const deps = await deputesIndex();
  return deps
    .filter((d) => d.num_departement === dept && (!circo || d.circo === circo))
    .sort((a, b) => (parseInt(a.circo ?? "0") || 0) - (parseInt(b.circo ?? "0") || 0));
}

// --- Drill-downs votes d'un député (client) ---------------------------------
function voteScrutin(s: ScrutinResume, position: string, consigne: string | null, cat: string): VoteScrutin {
  return { ...s, categorie: cat, position, consigne };
}
export async function getVotesDepute(uid: string, categorie: string, position: string, periode: Periode): Promise<VoteScrutin[]> {
  const [d, scrMap] = await Promise.all([depute(uid), scrutinsMap()]);
  const borne = bornePeriode(periode);
  if (position === "absent") {
    // Déduit : scrutins du thème dans la fenêtre du mandat, sans ligne de vote.
    const debut = [d.mandat_debut, borne].filter(Boolean).sort().pop() ?? null;
    const fin = d.mandat_fin ?? null;
    const out: VoteScrutin[] = [];
    for (const s of scrMap.values()) {
      if (!inCat(s, categorie)) continue;
      if (debut && (s.date ?? "") < debut) continue;
      if (fin && (s.date ?? "") > fin) continue;
      if (d.votes[s.uid]) continue;
      out.push(voteScrutin(s, "absent", null, categorie));
    }
    return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }
  const out: VoteScrutin[] = [];
  for (const [su, [pos, consigne]] of Object.entries(d.votes)) {
    if (pos !== position) continue;
    const s = scrMap.get(su);
    if (!s || !inCat(s, categorie)) continue;
    if (borne && (s.date ?? "") < borne) continue;
    out.push(voteScrutin(s, pos, consigne, categorie));
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}
// Positions d'un groupe par scrutin : { scrutin_uid: position }.
const groupePositions = (uid: string) => j<Record<string, string>>(`groupe/${uid}`);

/** Scrutins où le GROUPE a tenu une position donnée sur un thème (drill-down fiche parti). */
export async function getVotesParti(groupeUid: string, categorie: string, position: string, periode: Periode): Promise<VoteScrutin[]> {
  const [pos, scrMap] = await Promise.all([groupePositions(groupeUid), scrutinsMap()]);
  const borne = bornePeriode(periode);
  const out: VoteScrutin[] = [];
  for (const [su, p] of Object.entries(pos)) {
    if (p !== position) continue;
    const s = scrMap.get(su);
    if (!s || !inCat(s, categorie)) continue;
    if (borne && (s.date ?? "") < borne) continue;
    out.push(voteScrutin(s, position, null, categorie));
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export async function getVotesDeputeCategorie(uid: string, categorie: string, periode: Periode): Promise<VoteScrutin[]> {
  const [d, scrMap] = await Promise.all([depute(uid), scrutinsMap()]);
  const borne = bornePeriode(periode);
  const out: VoteScrutin[] = [];
  for (const [su, [pos, consigne]] of Object.entries(d.votes)) {
    const s = scrMap.get(su);
    if (!s || !inCat(s, categorie)) continue;
    if (borne && (s.date ?? "") < borne) continue;
    out.push(voteScrutin(s, pos, consigne, categorie));
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

// --- Scrutins d'une catégorie (client) --------------------------------------
export async function getScrutinsCategorie(id: string): Promise<ScrutinResume[]> {
  const scrs = await scrutinsIndex();
  return scrs.filter((s) => inCat(s, id)); // déjà triés par date desc
}

// --- Votants d'un scrutin (client, depuis le fichier scrutin) ---------------
export async function getVotants(scrutinUid: string, position: string, groupe?: string): Promise<Votant[]> {
  const detail = await j<any>(`scrutin/${scrutinUid}`);
  const list: any[] = detail.votants?.[position] ?? [];
  return (groupe ? list.filter((v) => v.groupe_uid === groupe) : list) as Votant[];
}

// --- Confrontation (client) -------------------------------------------------
export async function getConfrontation(aUid: string, bUid: string, periode: Periode): Promise<Confrontation> {
  const [deps, scrMap, cats, fa, fb] = await Promise.all([
    deputesIndex(), scrutinsMap(), getCategories(), depute(aUid), depute(bUid),
  ]);
  const a = deps.find((d) => d.uid === aUid)!;
  const b = deps.find((d) => d.uid === bUid)!;
  const borne = bornePeriode(periode);
  const themes = new Map<string, any>();
  cats.forEach((c) => themes.set(c.id, { id: c.id, libelle: c.libelle, ordre: c.ordre, communs: 0, desaccords: [], accords: [] }));
  let communs = 0, desaccords = 0;
  for (const [su, [posA]] of Object.entries(fa.votes)) {
    if (!EXPRIME(posA)) continue;
    const vb = fb.votes[su];
    if (!vb || !EXPRIME(vb[0])) continue;
    const s = scrMap.get(su);
    if (!s) continue;
    if (borne && (s.date ?? "") < borne) continue;
    const t = themes.get(s.categorie ?? "");
    if (!t) continue;
    const sc = { uid: s.uid, numero: s.numero, date: s.date, titre: s.titre, objet: null, sort_code: s.sort_code, resume: null, posA, posB: vb[0] };
    t.communs++; communs++;
    if (posA === vb[0]) t.accords.push(sc);
    else { t.desaccords.push(sc); desaccords++; }
  }
  for (const t of themes.values()) {
    t.desaccords.sort((x: any, y: any) => (y.date ?? "").localeCompare(x.date ?? ""));
    t.accords.sort((x: any, y: any) => (y.date ?? "").localeCompare(x.date ?? ""));
  }
  return {
    a, b, periode, communs, desaccords, accords: communs - desaccords,
    themes: [...themes.values()].sort((x, y) => x.ordre - y.ordre),
  };
}

// --- Shuffle de la confrontation (client) -----------------------------------
type PaireShuffle = { a: string; b: string; communs: number; accords: number; taux: number };
const ANGLES_SHUFFLE: AngleShuffle[] = ["fracture_interne", "alliance_contre_nature", "faux_duel"];
const shuffleData = () => j<Record<AngleShuffle, PaireShuffle[]>>("confrontation_shuffle");

/**
 * Pioche une paire surprenante dans un vivier pré-calculé. `angle` optionnel : si
 * absent, on en tire un au hasard (parmi ceux qui ont des paires). Léger biais vers
 * les meilleurs rangs (tirage le mieux classé sur deux), mais on garde de l'aléa.
 */
export async function getConfrontationShuffle(angle?: AngleShuffle): Promise<ShuffleConfrontation | null> {
  const [data, deps] = await Promise.all([shuffleData(), deputesIndex()]);
  const dispo = ANGLES_SHUFFLE.filter((a) => (data[a]?.length ?? 0) > 0);
  if (!dispo.length) return null;
  const choisi = angle && data[angle]?.length ? angle : dispo[Math.floor(Math.random() * dispo.length)];
  const paires = data[choisi] ?? [];
  if (!paires.length) return null;
  const byUid = new Map(deps.map((d) => [d.uid, d]));
  const i = Math.min(Math.floor(Math.random() * paires.length), Math.floor(Math.random() * paires.length));
  const p = paires[i];
  const a = byUid.get(p.a);
  const b = byUid.get(p.b);
  if (!a || !b) return null;
  return { angle: choisi, a, b, communs: p.communs, tauxAccord: p.taux };
}

/**
 * « Duel du jour » : UNE paire surprenante, STABLE sur toute la journée (même paire pour
 * tout le monde, qui « tourne » d'un jour à l'autre), piochée dans le vivier pré-calculé.
 * Déterministe par date (pas de Math.random) → ne bouge pas en cours de session.
 */
export async function getDuelDuJour(): Promise<ShuffleConfrontation | null> {
  const [data, deps] = await Promise.all([shuffleData(), deputesIndex()]);
  const toutes: { angle: AngleShuffle; p: PaireShuffle }[] = [];
  for (const a of ANGLES_SHUFFLE) for (const p of data[a] ?? []) toutes.push({ angle: a, p });
  if (!toutes.length) return null;
  const jour = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let h = 0;
  for (let i = 0; i < jour.length; i++) h = (h * 31 + jour.charCodeAt(i)) >>> 0;
  const { angle, p } = toutes[h % toutes.length];
  const byUid = new Map(deps.map((d) => [d.uid, d]));
  const a = byUid.get(p.a);
  const b = byUid.get(p.b);
  if (!a || !b) return null;
  return { angle, a, b, communs: p.communs, tauxAccord: p.taux };
}

// --- Recherche de commune (API Géo officielle, reste dynamique côté client) --
export interface Commune {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux?: string[];
}
export async function rechercheCommunes(q: string): Promise<Commune[]> {
  const s = q.trim();
  const estCP = /^\d{5}$/.test(s);
  const base = "https://geo.api.gouv.fr/communes";
  const url = estCP
    ? `${base}?codePostal=${s}&fields=nom,code,codeDepartement,codesPostaux&format=json`
    : `${base}?nom=${encodeURIComponent(s)}&fields=nom,code,codeDepartement,codesPostaux&boost=population&limit=8&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return (await res.json()) as Commune[];
}
