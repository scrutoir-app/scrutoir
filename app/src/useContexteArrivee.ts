import { useEffect, useState } from "react";
import { contexteArrivee, onPromptChange, type ContexteArrivee } from "./pwa";

/**
 * `beforeinstallprompt` arrive de façon asynchrone (Android, Chromium). Avant de conclure
 * « Android sans invite », on l'attend jusqu'à ce délai après le début du chargement de la page :
 * l'écran d'arrivée ne montre pas l'onboarding pour basculer ensuite sur « Installer Scrutoir ».
 * L'attente se passe en pratique sous l'ouverture animée (splash).
 */
export const ATTENTE_INVITE_MS = 1500;

function ecoule(): number {
  try {
    return typeof performance !== "undefined" ? performance.now() : ATTENTE_INVITE_MS;
  } catch {
    return ATTENTE_INVITE_MS;
  }
}

/**
 * Contexte d'arrivée (pwa.ts), suivi en direct. `null` tant qu'un Android attend encore son
 * invite d'installation. Ensuite, la valeur suit l'invite : elle disparaît une fois l'app
 * installée ou l'invite refusée (`android-installable` → `android`). Un écran qui doit garder
 * sa variante (écran d'arrivée) la fige lui-même à l'ouverture.
 */
export function useContexteArrivee(): ContexteArrivee | null {
  const [fini, setFini] = useState(() => ecoule() >= ATTENTE_INVITE_MS);
  const [c, setC] = useState<ContexteArrivee>(() => contexteArrivee());

  useEffect(() => {
    const maj = () => setC(contexteArrivee());
    const off = onPromptChange(maj);
    maj(); // l'invite a pu arriver entre le rendu et l'effet
    const reste = Math.max(0, ATTENTE_INVITE_MS - ecoule());
    const t = setTimeout(() => {
      maj();
      setFini(true);
    }, reste);
    return () => {
      clearTimeout(t);
      off();
    };
  }, []);

  if (c === "android" && !fini) return null;
  return c;
}
