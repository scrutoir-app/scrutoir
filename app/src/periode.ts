// Périodes glissantes « Depuis 2024 / 12 mois / 6 mois » — LOGIQUE PURE (aucun import React / RN),
// partagée par l'app (`api.ts` : fiches, drill-downs, confrontation) et le pipeline (`stats.ts` :
// profils exportés). Testée hors app (`periode.test.ts`, garde de refresh.yml).

export type PeriodeGlissante = "all" | "12m" | "6m";

/**
 * Borne basse (YYYY-MM-DD) d'une période comptée depuis `aujourdhui` (YYYY-MM-DD) : le même jour,
 * 6 ou 12 mois plus tôt, borné au dernier jour du mois visé. Un 31 août moins 6 mois donne le
 * 28 février (et non le 3 mars, comme le ferait `Date.setMonth`, qui déborde sur le mois suivant
 * et perdait les votes des derniers jours de février). null pour « all ».
 */
export function bornePeriode(p: PeriodeGlissante, aujourdhui: string): string | null {
  if (p === "all") return null;
  const [y, m, d] = aujourdhui.split("-").map(Number);
  const mois = m - 1 - (p === "12m" ? 12 : 6);
  const dernier = new Date(Date.UTC(y, mois + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mois, Math.min(d, dernier))).toISOString().slice(0, 10);
}
