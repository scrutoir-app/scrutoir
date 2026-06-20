import { useEffect, useState } from "react";

/**
 * Brique « Mon député + notifications » (reco 10).
 *
 * Côté client, on mémorise les élu·e·s suivi·e·s. Persistance via localStorage sur
 * le web ; fallback mémoire ailleurs (le branchement AsyncStorage natif est un TODO
 * volontairement non câblé pour ne pas ajouter de dépendance avant la mise en ligne).
 *
 * La NOTIFICATION « ton élu a voté sur tel scrutin » est posée comme brique mais ne
 * peut fonctionner qu'avec le backend en ligne : un job serveur compare, à chaque
 * nouvel ingest, les scrutins des élu·e·s suivi·e·s depuis la dernière vue, puis
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
  write(cur.includes(uid) ? cur.filter((u) => u !== uid) : [...cur, uid]);
}

/** Hook React : suit l'état de suivi d'un·e élu·e (re-render au changement). */
export function useFollow(uid: string): [boolean, () => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [isFollowed(uid), () => toggleFollow(uid)];
}

/** Hook React : liste réactive des élu·e·s suivi·e·s (pour l'écran Suivis). */
export function useFollows(): string[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return getFollows();
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
 * STUB (à implémenter côté serveur après mise en ligne) : pour chaque élu·e suivi·e,
 * détecter les scrutins postérieurs à la dernière consultation et déclencher une
 * notification push « {nom} a voté sur {scrutin} ». Nécessite un backend + tokens push.
 */
export async function notifierNouveauxVotes(): Promise<void> {
  // TODO(mise en ligne) : job serveur + expo-notifications. Sans backend, no-op.
}
