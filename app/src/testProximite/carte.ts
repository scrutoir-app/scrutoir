// Carte du test au swipe — LOGIQUE PURE (aucun import React / RN), testée hors app depuis
// pipeline/ (garde de refresh.yml). Ce que la carte affiche (intitulé officiel, n° et date du
// scrutin, progression) et comment un geste ou une touche devient une réponse. Jamais le
// résultat du vote : la carte ne lit ni `totaux` ni les positions des groupes.

import type { Reponse } from "./score";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date ISO (YYYY-MM-DD) en toutes lettres : « 9 juillet 2025 », « 1er juillet 2025 ». */
export function dateLongue(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const jour = Number(m[3]);
  const mois = MOIS[Number(m[2]) - 1];
  if (!mois || !jour) return null;
  return `${jour === 1 ? "1er" : jour} ${mois} ${m[1]}`;
}

/** Repère du scrutin sous l'intitulé : « Scrutin n° 2975 du 9 juillet 2025 ». */
export function libelleScrutin(numero: number, date: string | null | undefined): string {
  const d = dateLongue(date);
  return d ? `Scrutin n° ${numero} du ${d}` : `Scrutin n° ${numero}`;
}

/** Intitulé officiel de l'AN tel quel, seulement remis en phrase (initiale en capitale). */
export function intituleOfficiel(titre: string | null | undefined): string | null {
  const t = (titre ?? "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : null;
}

/** Progression neutre : « Carte 1 sur 8 » (index à partir de 0). */
export function libelleProgression(index: number, total: number): string {
  return `Carte ${index + 1} sur ${total}`;
}

// Zone morte : en dessous, le doigt n'a pas encore choisi de direction (aucune étiquette).
const ZONE_MORTE = 12;

/**
 * Direction DOMINANTE d'un glissé en cours (pour l'étiquette affichée sur la carte) :
 * l'axe le plus franc l'emporte. Horizontal → Pour (droite) / Contre (gauche) ; vertical
 * vers le haut → Sans avis. Vers le bas ou trop court → aucune.
 */
export function directionGlisse(dx: number, dy: number): Reponse | null {
  if (Math.abs(dx) < ZONE_MORTE && Math.abs(dy) < ZONE_MORTE) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "pour" : "contre";
  return dy < 0 ? "sans_avis" : null;
}

// Geste vif (vitesses du PanResponder, en px/ms) : sous le seuil, un coup de doigt rapide
// valide aussi, pourvu que la carte ait un peu bougé.
export const VITESSE_VALIDATION = 0.5;
export const COURSE_MIN = 30;

/**
 * Réponse au lâcher. D'abord la distance : la direction dominante, si le glissé a passé le
 * seuil sur son axe (même seuil pour les trois directions, Sans avis demande le même effort
 * que Pour / Contre). Sinon la vitesse : un geste court mais rapide valide aussi,
 * horizontal ou vers le haut, à condition d'aller dans le sens du glissé : une carte tirée à
 * gauche puis ramenée vite vers le centre revient, elle ne vaut pas « Pour ». Vers le bas :
 * jamais de réponse.
 */
export function decisionGeste(dx: number, dy: number, seuil: number, vx = 0, vy = 0): Reponse | null {
  const dir = directionGlisse(dx, dy);
  if ((dir === "pour" || dir === "contre") && Math.abs(dx) > seuil) return dir;
  if (dir === "sans_avis" && -dy > seuil) return dir;
  if (Math.abs(vx) >= Math.abs(vy) && Math.abs(vx) > VITESSE_VALIDATION && Math.abs(dx) >= COURSE_MIN && vx * dx > 0) return vx > 0 ? "pour" : "contre";
  if (-vy > VITESSE_VALIDATION && -dy >= COURSE_MIN) return "sans_avis";
  return null;
}

/** Clavier (web) : ← Contre, → Pour, ↑ Sans avis — les mêmes directions que le geste. */
export function reponseDeTouche(key: string): Reponse | null {
  if (key === "ArrowLeft") return "contre";
  if (key === "ArrowRight") return "pour";
  if (key === "ArrowUp") return "sans_avis";
  return null;
}
