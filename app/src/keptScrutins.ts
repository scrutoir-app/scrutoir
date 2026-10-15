/**
 * Marque-pages de scrutins « à lire plus tard » (geste « Garder » du Fil).
 *
 * VOLONTAIREMENT DISTINCT de `follows.ts` : le suivi (`useFollow`) vise des GROUPES et des
 * DÉPUTÉS (et déclenche un feed + à terme des notifications). « Garder » ne vise que des
 * SCRUTINS, sans notification ni feed — une simple liste locale de lecture. On calque la
 * mécanique de persistance (localStorage web ; fallback mémoire ailleurs), sans la mélanger.
 */

const KEY = "scrutoir.kept-scrutins";
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

export function getKept(): string[] {
  return [...read()];
}

export function isKept(uid: string): boolean {
  return read().includes(uid);
}

/** Bascule le marque-page. Renvoie le nouvel état (true = gardé) pour le retour visuel. */
export function toggleKept(uid: string): boolean {
  const cur = read();
  const was = cur.includes(uid);
  write(was ? cur.filter((u) => u !== uid) : [...cur, uid]);
  return !was;
}

/** Vide tous les marque-pages (Paramètres → « Sur cet appareil »). Rien n'est envoyé. */
export function viderKept(): void {
  write([]);
}

/**
 * Abonnement aux changements, pour les hooks React (`hooks/useKept.ts`). Renvoie le
 * désabonnement. Ce module reste PUR (sans React) : les tests de la garde du refresh
 * quotidien l'importent depuis pipeline/, où react n'est pas installé.
 */
export function abonnerKept(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
