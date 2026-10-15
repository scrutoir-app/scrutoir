// Spectre du résultat du test — LOGIQUE PURE (aucun import React / RN), testée hors app depuis
// pipeline/ (garde de refresh.yml). Ne recode PAS le score (`calculerProximite`) : ce module dit
// sur combien de votes repose le % de chaque groupe, et range sous le seuil de fiabilité (même
// seuil que les fiches, SEUIL_FIABILITE) les groupes dont on n'affiche pas de %. Tout reste sur
// l'appareil : rien n'est envoyé.

import { SEUIL_FIABILITE } from "../config";
import type { ResultatProximite } from "./score";

export interface LigneSpectre {
  abrev: string;
  /** Proximité (0..1) du moteur, ou null sous le seuil (on ne l'affiche pas). */
  pct: number | null;
  /** Votes comparés : scrutins où toi ET le groupe avez tranché, pour ou contre. */
  votes: number;
}

/** Votes comparés d'un groupe, tous thèmes confondus. */
export function votesCompares(res: ResultatProximite, abrev: string): number {
  return Object.values(res.parTheme).reduce((s, t) => s + (t[abrev]?.comparable ?? 0), 0);
}

/**
 * Lignes du spectre : `fiables` (≥ seuil votes comparés) dans l'ordre du moteur (% décroissant),
 * puis `faibles` (sous le seuil, sans %), du plus de votes au moins. Un groupe sans aucun vote
 * comparé n'apparaît pas (ex. les non-inscrits, qui n'ont pas de position de groupe).
 */
export function lignesSpectre(
  res: ResultatProximite,
  abrevs: string[],
  seuil: number = SEUIL_FIABILITE
): { fiables: LigneSpectre[]; faibles: LigneSpectre[] } {
  const rang = new Map(res.global.map((g, i) => [g.abrev, i]));
  const fiables: LigneSpectre[] = [];
  const faibles: LigneSpectre[] = [];
  for (const abrev of new Set(abrevs)) {
    const votes = votesCompares(res, abrev);
    if (!votes) continue;
    const i = rang.get(abrev);
    if (i != null && votes >= seuil) fiables.push({ abrev, pct: res.global[i].pct, votes });
    else faibles.push({ abrev, pct: null, votes });
  }
  fiables.sort((a, b) => rang.get(a.abrev)! - rang.get(b.abrev)!);
  faibles.sort((a, b) => b.votes - a.votes || a.abrev.localeCompare(b.abrev));
  return { fiables, faibles };
}

const votesTxt = (n: number) => `${n} vote${n > 1 ? "s" : ""}`;

/** Base sous le nom d'un groupe : « sur 7 votes ». */
export function surNVotes(n: number): string {
  return `sur ${votesTxt(n)}`;
}

/** Sous le titre : sur quoi repose tout le résultat. */
export function phraseBase(nbTranches: number): string {
  if (nbTranches <= 0) return "Tu n'as encore tranché aucun scrutin, pour ou contre. Un spectre, pas un verdict.";
  if (nbTranches === 1) return "Calculé sur le seul scrutin où tu as tranché, pour ou contre. Un spectre, pas un verdict.";
  return `Calculé sur les ${nbTranches} scrutins où tu as tranché, pour ou contre. Un spectre, pas un verdict.`;
}

/** Marge d'erreur, dite simplement, avec le seuil sous lequel il n'y a pas de %. */
export function phraseMarge(nbTranches: number, seuil: number = SEUIL_FIABILITE): string {
  return `Avec ${votesTxt(nbTranches)}, quelques points d'écart ne veulent rien dire. Sous ${seuil} votes comparés, on n'affiche pas de pourcentage.`;
}
