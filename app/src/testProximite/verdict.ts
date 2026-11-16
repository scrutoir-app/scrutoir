// Verdict « comme toi / pas comme toi » d'un scrutin, à DEUX niveaux — LOGIQUE PURE
// (aucun import RN), testable hors app. NE recode PAS de score : le niveau « déduit »
// consomme la sortie du moteur de proximité existant (calculerProximite via useJe), le
// niveau « voté » lit la vraie réponse de l'utilisateur (storage). Rien n'est envoyé au
// serveur : tout est recalculé côté client.

import type { ContexteJe } from "./jeProximite";
import type { Reponse } from "./score";
import type { GroupeVentilation } from "../types";
import { positionMajoritaire, type PositionVote } from "../decompte";

// Règle unique (décompte des votants, égalité ou aucun exprimé → null), la même que celle écrite
// en base par le pipeline : l'hémicycle, les verdicts et la ligne de chaque groupe ne divergent plus.
export { positionMajoritaire };

/** Sens du verdict, formulé CÔTÉ UTILISATEUR (jamais côté parti). */
export type Sens = "align" | "oppose" | "partage"; // dans ton sens / à l'opposé / partagé
/**
 * Niveau de certitude : voté (tu l'as tranché pour ou contre) · sans avis (tu as dit « sans
 * avis » : plus aucune déduction) · déduit (calculé de ton profil) · verrouillé (pas situé).
 */
export type Niveau = "vote" | "sans_avis" | "deduit" | "verrouille";

export interface Verdict {
  niveau: Niveau;
  sens: Sens | null; // null quand verrouillé ou sans avis
  /** Déduit : le camp qu'on te prête (null si Partagé). L'écran ne recalcule rien. */
  penche?: "pour" | "contre" | null;
}

/** Position (majorité) d'un groupe sur un scrutin + sa taille (hémicycle ; la déduction ne s'en sert plus). */
export interface GroupePos {
  abrev: string | null;
  taille: number;
  position: PositionVote | null; // null = égalité en tête ou aucun vote exprimé
}

const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Le camp qui l'a emporté : adopté → « pour » a gagné ; rejeté → « contre » a gagné. */
export function campGagnant(sortCode: string | null | undefined): "pour" | "contre" | null {
  if (sortCode === "adopte") return "pour";
  if (sortCode === "rejete") return "contre";
  return null;
}

/** Taille d'un groupe (effectif exprimé + absents) — taille des sièges dans l'hémicycle. */
export function tailleGroupe(g: Pick<GroupeVentilation, "pour" | "contre" | "abstention" | "absent">): number {
  return (g.pour || 0) + (g.contre || 0) + (g.abstention || 0) + (g.absent || 0);
}

/** Ventilation d'un scrutin → groupes ordonnables pour l'hémicycle et la déduction. */
export function groupesPos(groupes: GroupeVentilation[]): GroupePos[] {
  return groupes.map((g) => ({
    abrev: g.abrev,
    taille: tailleGroupe(g),
    position: positionMajoritaire(g),
  }));
}

/**
 * Niveau VOTÉ : la vraie réponse de l'utilisateur (clé = numéro de scrutin) comparée au
 * résultat. « sans_avis » / non répondu → pas de niveau voté (on bascule en déduit).
 */
export function verdictVote(reponse: Reponse | undefined, sortCode: string | null | undefined): Verdict | null {
  if (!tranche(reponse)) return null;
  const gagnant = campGagnant(sortCode);
  if (!gagnant) return null;
  return { niveau: "vote", sens: reponse === gagnant ? "align" : "oppose" };
}

/**
 * Niveau DÉDUIT : prédit le camp de l'utilisateur à partir de sa proximité PAR GROUPE
 * (ctx.resultat.global, produit par calculerProximite) puis compare au résultat. Le penchant
 * = le camp des groupes dont l'utilisateur est le plus proche : chaque groupe pèse sa proximité
 * à la puissance 4 (les groupes les plus proches dominent), côté = sa position majoritaire.
 * Quasi-égalité (< 8 %) ou rien de comparable → Partagé.
 * La TAILLE des groupes n'entre plus en compte (lot 5, validé le 16/11/2026) : multipliée par la
 * taille, la déduction penchait vers le camp qui gagne (« Comme toi » sur 76 % des scrutins pour
 * 66 % réels). Simulation sur les 33 questions, profil « vote comme le groupe X », question mise
 * de côté : 80 % → 93 % de déductions justes, 11 % → 3 % de fausses (cf. deduction.test.ts).
 */
export function verdictDeduit(
  ctx: ContexteJe | null,
  groupes: GroupePos[],
  sortCode: string | null | undefined
): Verdict {
  const gagnant = campGagnant(sortCode);
  if (!ctx || !gagnant) return { niveau: "deduit", sens: "partage", penche: null };
  const pct: Record<string, number> = {};
  for (const g of ctx.resultat.global) pct[g.abrev] = g.pct;

  let pour = 0, contre = 0;
  for (const g of groupes) {
    if (!g.abrev) continue;
    const p = pct[g.abrev];
    if (p == null) continue; // pas de comparable pour ce groupe → ignoré
    const w = p ** 4; // proximité puissance 4, sans la taille du groupe
    if (g.position === "pour") pour += w;
    else if (g.position === "contre") contre += w;
  }
  const somme = pour + contre;
  if (somme <= 0) return { niveau: "deduit", sens: "partage", penche: null };
  if (Math.abs(pour - contre) / somme < 0.08) return { niveau: "deduit", sens: "partage", penche: null };
  const penche: "pour" | "contre" = pour > contre ? "pour" : "contre";
  return { niveau: "deduit", sens: penche === gagnant ? "align" : "oppose", penche };
}

/**
 * Verdict complet d'un scrutin : verrouillé si pas situé, sinon voté (prioritaire), sans avis
 * (tu as dit « sans avis » : jamais de déduction à la place) ou déduit.
 */
export function verdictScrutin(opts: {
  ctx: ContexteJe | null;
  situe: boolean;
  reponse: Reponse | undefined;
  groupes: GroupePos[];
  sortCode: string | null | undefined;
}): Verdict {
  if (!opts.situe) return { niveau: "verrouille", sens: null };
  if (opts.reponse === "sans_avis") return { niveau: "sans_avis", sens: null };
  const vote = verdictVote(opts.reponse, opts.sortCode);
  if (vote) return vote;
  return verdictDeduit(opts.ctx, opts.groupes, opts.sortCode);
}

// --- Libellés (côté utilisateur, jamais côté parti) --------------------------------
/** Libellé court de pastille selon niveau + sens. */
export function verdictLabel(v: Verdict): string {
  if (v.niveau === "verrouille") return "Comme toi ?";
  if (v.niveau === "sans_avis") return "Sans avis";
  if (v.sens === "partage") return "Partagé";
  if (v.niveau === "vote") return v.sens === "align" ? "Comme ton vote" : "Pas comme ton vote";
  return v.sens === "align" ? "Comme toi" : "Pas comme toi";
}

/** Phrase complète (fiche détail). */
export function verdictPhrase(v: Verdict): string {
  if (v.niveau === "verrouille") return "Situe-toi pour voir si ce vote te ressemble";
  if (v.niveau === "sans_avis") return "Ta réponse : sans avis";
  if (v.sens === "partage") return "Ton profil est partagé sur ce vote";
  if (v.sens === "align") return "l'Assemblée a voté dans ton sens";
  return "l'Assemblée a voté à l'opposé de ton point de vue";
}
