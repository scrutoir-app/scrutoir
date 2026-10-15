import { useEffect, useState } from "react";
import { abonnerKept, isKept, toggleKept } from "../keptScrutins";

// Hook React des scrutins gardés, séparé du store `keptScrutins.ts` qui reste pur (sans
// React) pour la garde du refresh quotidien (cf. hooks/useFollows.ts).

/** Hook React : état de marque-page d'un scrutin (re-render au changement). */
export function useKept(uid: string): [boolean, () => boolean] {
  const [, force] = useState(0);
  useEffect(() => abonnerKept(() => force((n) => n + 1)), []);
  return [isKept(uid), () => toggleKept(uid)];
}
