/**
 * Paliers de réapparition du bandeau d'installation (InstallPrompt), sur iPhone / iPad. Le refus
 * reste mémorisé, mais le bandeau revient une fois quand les réponses franchissent 10, puis 33 :
 * plus il y a de réponses dans Safari, plus elles comptent. Module pur (testé hors appli).
 */

/** Palier de réponses (0, 10 ou 33) au dernier refus. Absent (refus d'avant la v1.44.0) = 0. */
export const CLE_PALIER_INSTALL = "scrutoir.install.palier";
export const PALIERS_INSTALL = [10, 33] as const;

/** Plus haut palier atteint par `n` réponses (0 sous le premier). */
export function palierDe(n: number): number {
  let p = 0;
  for (const s of PALIERS_INSTALL) if (n >= s) p = s;
  return p;
}

/** Bandeau visible malgré un refus : `n` réponses dépassent le palier mémorisé au refus. */
export function bandeauReparu(n: number, palierRefus: number): boolean {
  return palierDe(n) > palierRefus;
}
