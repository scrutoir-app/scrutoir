import type { QuestionProximite, Reponse } from "./score";

// Réglages partagés du test de proximité.

// Nb de NOUVELLES questions (non répondues) sous lequel « Affiner » reste masqué : on ne
// reproposera jamais un test déjà fait pour rien — il faut un stock de votes neufs à valoir.
export const SEUIL_AFFINER = 5;

// Nb de questions servies par session « Affiner ».
export const N_AFFINER = 8;

/** Compte des questions NON répondues par thème (pour les liens « +N à te positionner »). */
export function neuvesParTheme(all: QuestionProximite[], reponses: Record<number, unknown>): Record<string, number> {
  const c: Record<string, number> = {};
  for (const q of all) if (reponses[q.id] == null) c[q.theme] = (c[q.theme] ?? 0) + 1;
  return c;
}

/** Nb total de questions non répondues (gate « Affiner »). */
export function nbNeuves(all: QuestionProximite[], reponses: Record<number, unknown>): number {
  return all.reduce((n, q) => n + (reponses[q.id] == null ? 1 : 0), 0);
}

/**
 * Questions NON répondues, ordonnées pour APPROFONDIR : thèmes peu couverts d'abord, puis
 * thèmes à fort poids (Fort) — chaque session augmente la couverture là où elle manque le plus.
 */
export function questionsNeuves(
  all: QuestionProximite[],
  reponses: Record<number, Reponse>,
  poids?: Record<string, number>,
  theme?: string
): QuestionProximite[] {
  const couverture: Record<string, number> = {};
  for (const q of all) if (reponses[q.id] != null) couverture[q.theme] = (couverture[q.theme] ?? 0) + 1;
  let pool = all.filter((q) => reponses[q.id] == null);
  if (theme) pool = pool.filter((q) => q.theme === theme);
  // Score croissant = priorité : peu de couverture ET poids élevé passent devant.
  const prio = (q: QuestionProximite) => (couverture[q.theme] ?? 0) - (poids?.[q.theme] ?? 1);
  return [...pool].sort((a, b) => prio(a) - prio(b) || a.id - b.id);
}

// Sous ce nombre de questions validées, un test MONO-THÈME est verrouillé (échantillon
// trop faible pour un résultat fiable). Ne concerne PAS le test complet. Auto-déblocage :
// le compte vient de la donnée (/data/test-proximite.json, déjà filtrée sur « valide »),
// donc un thème s'active seul dès qu'il atteint le seuil après un import / de nouvelles validations.
export const SEUIL_TEST_THEME = 7;

// Message affiché quand un thème est verrouillé (texte exact).
export const MSG_THEME_VERROUILLE =
  "Pas encore assez de scrutins clivants sur ce thème pour un test fiable. Il s'activera dès qu'il y en aura assez.";

/** Nombre de questions (validées) par thème, à partir des questions exportées. */
export function compterParTheme(questions: Pick<QuestionProximite, "theme">[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const q of questions) c[q.theme] = (c[q.theme] ?? 0) + 1;
  return c;
}

/** Un test mono-thème est-il actif (assez de questions validées) ? */
export function themeTestActif(counts: Record<string, number>, theme: string): boolean {
  return (counts[theme] ?? 0) >= SEUIL_TEST_THEME;
}
