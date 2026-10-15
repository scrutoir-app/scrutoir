import { useEffect, useState } from "react";
import { abonnerSuivis, getFollows, isFollowed, toggleFollow } from "../follows";

// Hooks React des suivis, séparés du store `follows.ts` qui reste pur (sans React) : les
// tests de la garde du refresh quotidien l'importent depuis pipeline/, où react n'est pas
// installé. Même découpage que hebdo.ts / useHebdo.ts.

/** Re-rendu à chaque changement de la liste des suivis. */
function useRafraichiSurSuivis(): void {
  const [, force] = useState(0);
  useEffect(() => abonnerSuivis(() => force((n) => n + 1)), []);
}

/** Hook React : suit l'état de suivi d'un élu (re-render au changement). */
export function useFollow(uid: string): [boolean, () => void] {
  useRafraichiSurSuivis();
  return [isFollowed(uid), () => toggleFollow(uid)];
}

/** Hook React : liste réactive des élus suivis (pour l'écran Suivis). */
export function useFollows(): string[] {
  useRafraichiSurSuivis();
  return getFollows();
}
