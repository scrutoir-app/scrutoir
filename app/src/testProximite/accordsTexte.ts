// « Tes accords » au niveau d'un TEXTE — LOGIQUE PURE (aucun import React / RN), testable
// hors app depuis pipeline/. Pour le dernier texte où l'utilisateur s'est situé : sa réponse
// (pour / contre) sur un scrutin de ce texte, comparée à la position de chaque groupe sur ce
// même scrutin. Tout se calcule sur l'appareil, à partir de fichiers déjà chargés pour tout le
// monde (questions du test + index des scrutins) : aucune requête ne dépend des réponses.

import type { PositionGroupe, QuestionProximite, Reponse } from "./score";

/** Accord d'un groupe avec toi sur un scrutin : comme toi, pas comme toi, ou rien de comparable. */
export type Accord = "comme" | "pas" | "neutre";

const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Abstention, position partagée, groupe absent ou « sans avis » → neutre (jamais compté). */
export function accordGroupe(position: PositionGroupe | string | null | undefined, reponse: Reponse | string | null | undefined): Accord {
  if (!tranche(position) || !tranche(reponse)) return "neutre";
  return position === reponse ? "comme" : "pas";
}

export interface AccordTexte {
  /** Numéro du scrutin retenu (= id de la question du test). */
  numero: number;
  reponse: "pour" | "contre";
  /** abrev → accord, pour chacun des groupes demandés. */
  parGroupe: Record<string, Accord>;
  /** Nombre de groupes qui ont voté comme toi. */
  comme: number;
  /** Nombre de groupes considérés (dénominateur affiché : « N groupes sur 11 »). */
  total: number;
}

/**
 * Accord par groupe sur le dernier scrutin tranché (pour / contre) d'un texte. Le scrutin
 * retenu est celui de plus grand numéro (le plus récent) parmi les questions du texte que tu
 * as tranchées. `dossierDe` relie un numéro de scrutin à son texte. null si tu n'as rien
 * tranché sur ce texte.
 */
export function accordTexte(
  dossierRef: string,
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  dossierDe: (numero: number) => string | null | undefined,
  abrevs: string[]
): AccordTexte | null {
  let retenue: QuestionProximite | null = null;
  for (const q of questions) {
    if (!tranche(reponses[q.id]) || dossierDe(q.id) !== dossierRef) continue;
    if (!retenue || q.id > retenue.id) retenue = q;
  }
  if (!retenue) return null;
  const reponse = reponses[retenue.id] as "pour" | "contre";
  const parGroupe: Record<string, Accord> = {};
  let comme = 0;
  for (const abrev of abrevs) {
    const a = accordGroupe(retenue.positions?.[abrev], reponse);
    parGroupe[abrev] = a;
    if (a === "comme") comme++;
  }
  return { numero: retenue.id, reponse, parGroupe, comme, total: abrevs.length };
}

/**
 * Accord sur le plus récent des textes `refs` (ordre attendu : du plus récent au plus ancien)
 * où tu as tranché une question du test. Un texte sans question encore au test (question
 * retirée depuis) est sauté. null si aucun texte ne convient.
 */
export function dernierAccord(
  refs: string[],
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  dossierDe: (numero: number) => string | null | undefined,
  abrevs: string[]
): (AccordTexte & { ref: string }) | null {
  for (const ref of refs) {
    const a = accordTexte(ref, questions, reponses, dossierDe, abrevs);
    if (a) return { ...a, ref };
  }
  return null;
}

/**
 * Progression du test : questions déjà tranchées (pour, contre OU sans avis : « sans avis »
 * compte autant que les deux autres) sur le total des questions du test.
 */
export function progressionTest(questions: QuestionProximite[], reponses: Record<number, unknown>): { faits: number; total: number; restants: number } {
  const total = questions.length;
  const faits = questions.reduce((n, q) => n + (reponses[q.id] != null ? 1 : 0), 0);
  return { faits, total, restants: total - faits };
}
