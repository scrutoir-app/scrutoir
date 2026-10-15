// Décomptes de vote EN CLAIR (« 10 pour, 1 abst. ») — LOGIQUE PURE,
// aucun import RN : testée hors app (`decompte.test.ts`, garde de refresh.yml). Remplace les
// barres sans légende et les abréviations « 14 p · 1 a » : on écrit les nombres en toutes lettres.

export interface Compte {
  pour: number;
  contre: number;
  abstention: number;
}

export type PositionVote = "pour" | "contre" | "abstention";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312

/** « 10 pour, 1 abst. » (seules les positions non nulles, ordre pour · contre · abst.) ; "" si aucun vote. */
export function decompteClair(c: Compte): string {
  return [
    c.pour > 0 ? `${fmt(c.pour)} pour` : null,
    c.contre > 0 ? `${fmt(c.contre)} contre` : null,
    c.abstention > 0 ? `${fmt(c.abstention)} abst.` : null,
  ].filter(Boolean).join(", ");
}
