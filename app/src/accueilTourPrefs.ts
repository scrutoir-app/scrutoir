/**
 * Déclenchement « une seule fois » de la visite guidée de l'accueil, à la PREMIÈRE arrivée sur
 * l'accueil quand l'utilisateur s'est situé (test fait). Même patron de persistance que
 * `onboardingPrefs` : localStorage sur le web, repli mémoire ailleurs, versionné par clé. La
 * visite reste rejouable à volonté via le « ? » du masthead (cf. `tour.ts`) — cette persistance
 * ne gouverne QUE le lancement automatique initial.
 */
const KEY = "scrutoir.tour.accueil.seen";
const VERSION = "1";

let seenCache: string | null | undefined; // undefined = pas encore lu

function lireSeen(): string | null {
  if (seenCache !== undefined) return seenCache;
  try {
    seenCache = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  } catch {
    seenCache = null;
  }
  return seenCache;
}

/** La visite d'accueil doit-elle se lancer automatiquement ? (jamais vue). */
export function tourAccueilAFaire(): boolean {
  return lireSeen() !== VERSION;
}

/** Mémorise « visite d'accueil proposée » : ne plus la relancer automatiquement. */
export function marquerTourAccueilVu(): void {
  seenCache = VERSION;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, VERSION);
  } catch {
    /* fallback mémoire */
  }
}
