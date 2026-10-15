import { track } from "./analytics";

/**
 * Brique « Mon député + notifications » (reco 10).
 *
 * Côté client, on mémorise les élus suivis. Persistance via localStorage sur
 * le web ; fallback mémoire ailleurs (le branchement AsyncStorage natif est un TODO
 * volontairement non câblé pour ne pas ajouter de dépendance avant la mise en ligne).
 *
 * La NOTIFICATION « ton élu a voté sur tel scrutin » est posée comme brique mais ne
 * peut fonctionner qu'avec le backend en ligne : un job serveur compare, à chaque
 * nouvel ingest, les scrutins des élus suivis depuis la dernière vue, puis
 * pousse via expo-notifications. Voir `notifierNouveauxVotes()` (stub) plus bas.
 */

const KEY = "hemicycle.follows";
let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function write(uids: string[]) {
  cache = uids;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(uids));
  } catch {
    /* fallback mémoire */
  }
  listeners.forEach((l) => l());
}

export function getFollows(): string[] {
  return [...read()];
}

export function isFollowed(uid: string): boolean {
  return read().includes(uid);
}

export function toggleFollow(uid: string) {
  const cur = read();
  const wasFollowed = cur.includes(uid);
  write(wasFollowed ? cur.filter((u) => u !== uid) : [...cur, uid]);
  // Analytics : on distingue parti (uid PO…) et député (PA…) pour des classements nets.
  const isParti = uid.startsWith("PO");
  track(
    wasFollowed ? (isParti ? "unfollow_parti" : "unfollow") : (isParti ? "follow_parti" : "follow"),
    uid
  );
}

/**
 * Suivi AUTOMATIQUE (non initié par l'utilisateur) : ajoute l'élu s'il n'est pas déjà suivi,
 * SANS événement analytics. Réservé aux suivis déduits d'un résultat — ex. le groupe le plus
 * proche au test de proximité : tracer ce uid enverrait le résultat du test, donnée d'opinion
 * politique (RGPD art. 9) qui ne doit pas quitter l'appareil. Idempotent, ne retire jamais.
 */
export function suivreSansMesure(uid: string) {
  const cur = read();
  if (!uid || cur.includes(uid)) return;
  write([...cur, uid]);
}

/**
 * Retire TOUS les suivis (Paramètres → « Tout effacer sur cet appareil »), avec la date de
 * dernière consultation de l'onglet Suivis. SANS track() : un effacement n'envoie rien
 * (contrairement à toggleFollow, qui mesure chaque geste unitaire).
 */
export function viderSuivis(): void {
  seenCache = "";
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(SEEN_KEY);
  } catch {
    /* fallback mémoire */
  }
  write([]);
}

/**
 * Abonnement aux changements, pour les hooks React (`hooks/useFollows.ts`). Renvoie le
 * désabonnement. Ce module reste PUR (sans React) : les tests de la garde du refresh
 * quotidien l'importent depuis pipeline/, où react n'est pas installé.
 */
export function abonnerSuivis(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

// Date (YYYY-MM-DD) de la dernière consultation de l'onglet Suivis : sert à marquer
// « nouveau » les votes plus récents. Stockée en localStorage (web), sinon mémoire.
const SEEN_KEY = "scrutoir.suivis.lastSeen";
let seenCache: string | null = null;

export function getLastSeen(): string {
  if (seenCache !== null) return seenCache;
  try {
    seenCache = (typeof localStorage !== "undefined" ? localStorage.getItem(SEEN_KEY) : null) || "";
  } catch {
    seenCache = "";
  }
  return seenCache;
}

export function markSeen(): void {
  const today = new Date().toISOString().slice(0, 10);
  seenCache = today;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEN_KEY, today);
  } catch {
    /* fallback mémoire */
  }
}

/**
 * STUB (à implémenter côté serveur après mise en ligne) : pour chaque élu suivi,
 * détecter les scrutins postérieurs à la dernière consultation et déclencher une
 * notification push « {nom} a voté sur {scrutin} ». Nécessite un backend + tokens push.
 */
export async function notifierNouveauxVotes(): Promise<void> {
  // TODO(mise en ligne) : job serveur + expo-notifications. Sans backend, no-op.
}
