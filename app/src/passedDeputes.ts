import { useEffect, useState } from "react";

/**
 * Députés « passés » du deck d'affinité (geste « Passer »).
 *
 * VOLONTAIREMENT DISTINCT de `follows.ts` : suivre (`useFollow`) est un choix POSITIF qui
 * alimente le feed des suivis et, à terme, des notifications. « Passer » ne fait que RETIRER
 * un député du deck pour ne plus le re-proposer — aucun feed, aucune notification, aucun
 * compteur, aucun envoi serveur. On calque la mécanique de persistance de `keptScrutins.ts`
 * (localStorage web ; fallback mémoire ailleurs), sans la mélanger.
 */

const KEY = "scrutoir.passed-deputes";
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
    /* quota / mode privé : on garde la mémoire */
  }
  listeners.forEach((l) => l());
}

export function getPassed(): string[] {
  return [...read()];
}

export function isPassed(uid: string): boolean {
  return read().includes(uid);
}

/** Marque un député comme passé (ne réapparaît plus dans le deck). */
export function passer(uid: string): void {
  const cur = read();
  if (!cur.includes(uid)) write([...cur, uid]);
}

/** Annule le « passer » (bouton Annuler du deck). */
export function annulerPasser(uid: string): void {
  const cur = read();
  if (cur.includes(uid)) write(cur.filter((u) => u !== uid));
}

/** Hook React : liste réactive des députés passés. */
export function usePassed(): string[] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return getPassed();
}
