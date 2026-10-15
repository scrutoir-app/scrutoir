// « Tes accords » au niveau d'un TEXTE — LOGIQUE PURE (aucun import React / RN), testable
// hors app depuis pipeline/. Pour le dernier texte où l'utilisateur s'est situé : sa réponse
// (pour / contre) sur un scrutin de ce texte, comparée à la position de chaque groupe sur ce
// même scrutin. Tout se calcule sur l'appareil, à partir de fichiers déjà chargés pour tout le
// monde (questions du test + index des scrutins) : aucune requête ne dépend des réponses.

import type { PositionGroupe, QuestionProximite, Reponse } from "./score";
import { positionMajoritaire } from "../decompte";

/** Accord d'un groupe avec toi sur un scrutin : comme toi, pas comme toi, ou rien de comparable. */
export type Accord = "comme" | "pas" | "neutre";

const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Abstention, position partagée, groupe absent ou « sans avis » → neutre (jamais compté). */
export function accordGroupe(position: PositionGroupe | string | null | undefined, reponse: Reponse | string | null | undefined): Accord {
  if (!tranche(position) || !tranche(reponse)) return "neutre";
  return position === reponse ? "comme" : "pas";
}

/**
 * Position d'un groupe sur une question du test, pour « Tes accords » : recalculée sur ses votants
 * avec `positionMajoritaire` (decompte.ts, v1.20.1 : la plus nombreuse ; égalité en tête ou aucun
 * vote exprimé → aucune position, donc gris). Les votants sont rangés par groupe ACTUEL du député,
 * comme le test. Repli sur la position du test quand le fichier n'a pas encore les décomptes.
 */
export function positionPourAccord(q: Pick<QuestionProximite, "positions" | "decomptes">, abrev: string): PositionGroupe | null {
  if (q.decomptes) {
    const c = q.decomptes[abrev];
    return c ? positionMajoritaire(c) : null;
  }
  return q.positions?.[abrev] ?? null;
}

export interface AccordTexte {
  /** Numéro du scrutin retenu (= id de la question du test). */
  numero: number;
  reponse: "pour" | "contre";
  /** abrev → accord, pour chacun des groupes demandés. */
  parGroupe: Record<string, Accord>;
  /** Nombre de groupes qui ont voté comme toi. */
  comme: number;
  /** Nombre de groupes qui ont voté autrement (pour quand tu es contre, ou l'inverse). */
  pas: number;
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
  let pas = 0;
  for (const abrev of abrevs) {
    const a = accordGroupe(positionPourAccord(retenue, abrev), reponse);
    parGroupe[abrev] = a;
    if (a === "comme") comme++;
    else if (a === "pas") pas++;
  }
  return { numero: retenue.id, reponse, parGroupe, comme, pas, total: abrevs.length };
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
 * Écran « Tes accords » : l'accord par groupe sur chacun des textes `refs` (du plus récent au plus
 * ancien) où tu as tranché une question du test. Un texte sans question encore au test est sauté.
 */
export function accordsParTexte(
  refs: string[],
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  dossierDe: (numero: number) => string | null | undefined,
  abrevs: string[]
): (AccordTexte & { ref: string })[] {
  const out: (AccordTexte & { ref: string })[] = [];
  for (const ref of refs) {
    const a = accordTexte(ref, questions, reponses, dossierDe, abrevs);
    if (a) out.push({ ...a, ref });
  }
  return out;
}

/** « 7 groupes sur 11 », « 1 groupe sur 11 », « Aucun groupe sur 11 ». */
export function libelleGroupes(n: number, total: number): string {
  if (n === 0) return `Aucun groupe sur ${total}`;
  return `${n} groupe${n > 1 ? "s" : ""} sur ${total}`;
}

/** La majorité des groupes a voté comme toi (le compte passe en vert, sinon il reste neutre). */
export function majoriteCommeToi(a: Pick<AccordTexte, "comme" | "total">): boolean {
  return a.total > 0 && a.comme * 2 > a.total;
}

/**
 * Ce que dit l'hémicycle, pour un lecteur d'écran, SANS nommer de groupe : « 7 groupes sur 11 ont
 * voté comme toi, 2 autrement, 2 ni pour ni contre ou à égalité ».
 */
export function phraseAccord(a: Pick<AccordTexte, "comme" | "pas" | "total">): string {
  const neutre = a.total - a.comme - a.pas;
  const tete = a.comme === 0
    ? `Aucun groupe sur ${a.total} n'a voté comme toi`
    : `${libelleGroupes(a.comme, a.total)} ${a.comme > 1 ? "ont" : "a"} voté comme toi`;
  return [tete, a.pas ? `${a.pas} autrement` : null, neutre ? `${neutre} ni pour ni contre ou à égalité` : null].filter(Boolean).join(", ");
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
