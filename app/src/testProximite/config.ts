import type { QuestionProximite } from "./score";

// Réglages partagés du test de proximité.

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
