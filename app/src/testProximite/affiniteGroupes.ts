// Onglet Partis, une fois situé : le « % comme toi » de chaque groupe et l'ordre de la liste —
// LOGIQUE PURE (aucun import React / RN), testée hors app depuis pipeline/ (garde de refresh.yml).
// Ne recode PAS le score : reprend `lignesSpectre` (spectre du résultat du test), donc les mêmes
// %, la même base « sur N votes » et le même seuil (SEUIL_FIABILITE) que le résultat. Tout reste
// sur l'appareil : rien n'est envoyé.

import { SEUIL_FIABILITE } from "../config";
import { lignesSpectre } from "./spectre";
import type { ResultatProximite } from "./score";

export interface AffiniteGroupe<P> {
  parti: P;
  /** Proximité (0..1) du moteur, ou null : sous le seuil, ou aucun vote comparé. */
  pct: number | null;
  /** Votes comparés : scrutins où toi ET le groupe avez tranché, pour ou contre. */
  votes: number;
}

/**
 * Lignes de l'onglet Partis. Sans résultat (pas situé) : l'ordre par nombre de sièges, sans %.
 * Situé : par affinité décroissante, l'ordre même du spectre (groupes au-dessus du seuil, % du
 * moteur), puis les groupes sous le seuil (sans %, du plus de votes comparés au moins), puis ceux
 * sans aucun vote comparé (non-inscrits : pas de position de groupe), par nombre de sièges.
 */
export function affiniteGroupes<P extends { abrev: string | null; nb_deputes: number }>(
  partis: P[],
  res: ResultatProximite | null,
  seuil: number = SEUIL_FIABILITE
): AffiniteGroupe<P>[] {
  const parSieges = [...partis].sort((a, b) => b.nb_deputes - a.nb_deputes);
  if (!res) return parSieges.map((parti) => ({ parti, pct: null, votes: 0 }));
  const { fiables, faibles } = lignesSpectre(res, parSieges.flatMap((p) => (p.abrev ? [p.abrev] : [])), seuil);
  const parAbrev = new Map(parSieges.map((p) => [p.abrev, p]));
  const out: AffiniteGroupe<P>[] = [...fiables, ...faibles].map((l) => ({ parti: parAbrev.get(l.abrev)!, pct: l.pct, votes: l.votes }));
  const places = new Set(out.map((l) => l.parti));
  for (const parti of parSieges) if (!places.has(parti)) out.push({ parti, pct: null, votes: 0 });
  return out;
}
