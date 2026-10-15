import { useEffect, useState } from "react";
import { abonnerPasses, getPassed } from "../passedDeputes";

// Hook React des députés passés, séparé du store `passedDeputes.ts` qui reste pur (sans
// React) pour la garde du refresh quotidien (cf. hooks/useFollows.ts).

/** Hook React : liste réactive des députés passés. */
export function usePassed(): string[] {
  const [, force] = useState(0);
  useEffect(() => abonnerPasses(() => force((n) => n + 1)), []);
  return getPassed();
}
