import { useEffect, useState } from "react";
import { getFollows } from "./follows";
import { chargerTest } from "./testProximite/storage";

/**
 * Overlay d'onboarding première connexion (recentrage « je »). Même mécanique locale que
 * parcoursLoiPrefs : localStorage + fallback mémoire, aucune donnée réseau. Montré UNE fois,
 * et SEULEMENT à un utilisateur réellement nouveau (aucun suivi ET aucun test). Relançable
 * depuis l'accueil via `relancerOnboarding()`. La visibilité vit dans un petit store module
 * + listeners (comme follows) pour que l'accueil puisse le rouvrir sans prop-drilling.
 */
const KEY = "scrutoir.onboarding.seen";
const VERSION = "1";

let seenCache: string | null | undefined; // undefined = pas encore lu
let visible = false;
let initialized = false;
const listeners = new Set<() => void>();

function lireSeen(): string | null {
  if (seenCache !== undefined) return seenCache;
  try {
    seenCache = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  } catch {
    seenCache = null;
  }
  return seenCache;
}

function marquerVu(): void {
  seenCache = VERSION;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, VERSION);
  } catch {
    /* fallback mémoire */
  }
}

/** Nouveau venu éligible : jamais vu, aucun suivi, aucun test fait. */
function premierLancement(): boolean {
  if (lireSeen() === VERSION) return false;
  if (getFollows().length > 0) return false;
  const test = chargerTest();
  return !test || !Object.keys(test.reponses).length;
}

/** `reporte` (1er appel seulement) : pas montré à ce lancement, PAS marqué vu (proposé au suivant). */
function ensureInit(reporte = false): void {
  if (initialized) return;
  initialized = true;
  visible = !reporte && premierLancement();
  if (visible) marquerVu(); // proposé = vu : ne pas re-proposer au prochain chargement
}

function notify(): void {
  listeners.forEach((l) => l());
}

/** Rouvre l'overlay (depuis l'accueil). */
export function relancerOnboarding(): void {
  ensureInit();
  visible = true;
  notify();
}

/** Ferme l'overlay (et mémorise « vu »). */
export function fermerOnboarding(): void {
  ensureInit();
  visible = false;
  marquerVu();
  notify();
}

/**
 * Hook : l'overlay doit-il être visible ? (réactif aux relance/fermeture)
 * `reporte` : arrivée par un lien direct de la rubrique Présidentielle (lu au 1er appel).
 */
export function useOnboardingVisible(reporte = false): boolean {
  ensureInit(reporte);
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return visible;
}
