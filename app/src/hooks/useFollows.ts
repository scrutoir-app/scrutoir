import { useEffect, useState } from "react";
import { abonnerSuivis, getFollows, isFollowed, toggleFollow, toggleFollowSansUid } from "../follows";

// Hooks React des suivis, séparés du store `follows.ts` qui reste pur (sans React) : les
// tests de la garde du refresh quotidien l'importent depuis pipeline/, où react n'est pas
// installé. Même découpage que hebdo.ts / useHebdo.ts.

/** Re-rendu à chaque changement de la liste des suivis. */
function useRafraichiSurSuivis(): void {
  const [, force] = useState(0);
  useEffect(() => abonnerSuivis(() => force((n) => n + 1)), []);
}

/**
 * Hook React : suit l'état de suivi d'un élu (re-render au changement). `sansUid` : le geste
 * est mesuré sans dire qui est suivi (écran de résultat du test, cf. `toggleFollowSansUid`).
 */
export function useFollow(uid: string, { sansUid = false }: { sansUid?: boolean } = {}): [boolean, () => void] {
  useRafraichiSurSuivis();
  return [isFollowed(uid), () => (sansUid ? toggleFollowSansUid(uid) : toggleFollow(uid))];
}

/** Hook React : liste réactive des élus suivis (pour l'écran Suivis). */
export function useFollows(): string[] {
  useRafraichiSurSuivis();
  return getFollows();
}
