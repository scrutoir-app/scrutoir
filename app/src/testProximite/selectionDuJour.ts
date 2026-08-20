/**
 * Sélection du jour du deck d'affinité (« Trouver un député » → Par affinité).
 *
 * Deux règles, contre le deck « catalogue » :
 *  1. **Par lots quotidiens** — on propose TAILLE_LOT députés par jour, pas les 577 d'un coup.
 *     Le lot est figé pour la journée (rechargement de page compris) et les députés déjà
 *     proposés ne reviennent jamais (`vus`).
 *  2. **Au hasard, pas par classement** — un deck trié du plus proche au moins proche donne
 *     des séries homogènes (« 20 députés à 20 % ») qu'on arrête de consulter. On tire donc au
 *     sort, en garantissant seulement de la VARIÉTÉ : un tiers proche, un tiers médian, un
 *     tiers éloigné, puis mélange — chaque lot contient des profils contrastés.
 *
 * 100 % client : tirage local, persistance localStorage (repli mémoire), rien n'est envoyé.
 */

const KEY_LOT = "scrutoir.affinite.lot";
const KEY_VUS = "scrutoir.affinite.vus";

/** Nombre de députés proposés par jour. */
export const TAILLE_LOT = 8;

/** Tout ce qu'il faut savoir d'un député pour le tirage (structurel : aucun import runtime). */
interface Classable {
  resume: { uid: string };
  score: { pct: number };
}

// ---------------------------------------------------------------- hasard reproductible
/** Hash 32 bits (FNV-1a) d'une chaîne — graine du générateur. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) : même graine → même tirage. Le lot
 * du jour reste donc identique même là où localStorage n'existe pas (natif, mode privé).
 */
export function alea(graine: string): () => number {
  let a = hash(graine);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mélange de Fisher-Yates sur une COPIE (l'entrée n'est jamais réordonnée). */
export function melanger<T>(xs: readonly T[], rnd: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Quotas par étage (proche / médian / éloigné) pour une taille de lot donnée. */
function quotas(taille: number): [number, number, number] {
  const b = Math.floor(taille / 3);
  const r = taille % 3;
  return [b + (r > 0 ? 1 : 0), b + (r > 1 ? 1 : 0), b];
}

/**
 * Tire `taille` députés du vivier : hasard stratifié sur 3 étages d'affinité, puis mélange
 * (l'ordre des cartes ne dit RIEN de la proximité). Si un étage est trop court, on complète
 * au hasard dans le reste.
 */
export function tirerLot<T extends Classable>(pool: readonly T[], taille: number, rnd: () => number): T[] {
  if (pool.length <= taille) return melanger(pool, rnd);
  const ordre = [...pool].sort((a, b) => b.score.pct - a.score.pct);
  const n = ordre.length;
  const etages = [
    ordre.slice(0, Math.ceil(n / 3)),
    ordre.slice(Math.ceil(n / 3), Math.ceil((2 * n) / 3)),
    ordre.slice(Math.ceil((2 * n) / 3)),
  ];
  const q = quotas(taille);
  const pris: T[] = [];
  const restes: T[] = [];
  etages.forEach((etage, i) => {
    const m = melanger(etage, rnd);
    pris.push(...m.slice(0, q[i]));
    restes.push(...m.slice(q[i]));
  });
  for (const d of melanger(restes, rnd)) {
    if (pris.length >= taille) break;
    pris.push(d);
  }
  return melanger(pris, rnd);
}

// ---------------------------------------------------------------- persistance du lot
/** Jour local au format `AAAA-MM-JJ` (le lot tourne à minuit, heure de l'utilisateur). */
export function jourCourant(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface LotStocke {
  jour: string;
  uids: string[];
}

let memLot: LotStocke | null = null;
let memVus: string[] | null = null;

function lire<T>(cle: string): T | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(cle) : null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function ecrire(cle: string, val: unknown): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cle, JSON.stringify(val));
  } catch {
    /* quota / mode privé : les caches mémoire prennent le relais */
  }
}

/** Députés DÉJÀ proposés dans un lot passé (ils ne reviennent plus). */
export function getVus(): string[] {
  if (!memVus) memVus = lire<string[]>(KEY_VUS) ?? [];
  return [...memVus];
}

function marquerVus(uids: string[]): void {
  const set = new Set([...getVus(), ...uids]);
  memVus = [...set];
  ecrire(KEY_VUS, memVus);
}

function lotStocke(): LotStocke | null {
  if (!memLot) memLot = lire<LotStocke>(KEY_LOT);
  return memLot;
}

/** Combien de députés du vivier restent à découvrir (jamais proposés). */
export function resteAVoir<T extends Classable>(pool: readonly T[]): number {
  const vus = new Set(getVus());
  return pool.filter((d) => !vus.has(d.resume.uid)).length;
}

/**
 * Le lot du jour, à partir du vivier (déjà purgé des suivis et des passés).
 *
 * - même journée → on rejoue le lot enregistré (les cartes déjà tranchées ont quitté le
 *   vivier, donc la liste rétrécit au fil des swipes : c'est ce qui reste à voir aujourd'hui) ;
 * - nouvelle journée → on tire un lot neuf parmi les non-vus et on l'enregistre.
 */
export function lotDuJour<T extends Classable>(
  pool: readonly T[],
  taille: number = TAILLE_LOT,
  jour: string = jourCourant()
): T[] {
  const parUid = new Map(pool.map((d) => [d.resume.uid, d]));
  const stocke = lotStocke();
  if (stocke && stocke.jour === jour) {
    return stocke.uids.map((u) => parUid.get(u)).filter((d): d is T => !!d);
  }

  const vus = new Set(getVus());
  const frais = pool.filter((d) => !vus.has(d.resume.uid));
  const lot = tirerLot(frais, taille, alea(`${jour}|${KEY_LOT}`));
  const uids = lot.map((d) => d.resume.uid);
  memLot = { jour, uids };
  ecrire(KEY_LOT, memLot);
  marquerVus(uids);
  return lot;
}

/** Repart de zéro : oublie les députés déjà proposés et le lot en cours. */
export function reinitialiserSelection(): void {
  memLot = null;
  memVus = [];
  ecrire(KEY_VUS, []);
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY_LOT);
  } catch {
    /* mémoire seule */
  }
}
