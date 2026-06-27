import { useEffect, useState } from "react";
import { PARCOURS_VERSION } from "./content/parcoursLoi";

/**
 * Persistance locale de l'interstitiel « parcours d'une loi » (même mécanique que
 * follows/prefs : localStorage + fallback mémoire). On enregistre la VERSION de contenu
 * vue → l'interstitiel ne réapparaît pas une fois vu/fermé, MAIS est re-proposé si le
 * contenu pédagogique change (bump de PARCOURS_VERSION). 100 % local, aucun réseau.
 */
const KEY = "scrutoir.parcoursLoi.seen";
let cache: string | null | undefined; // undefined = pas encore lu

function read(): string | null {
  if (cache !== undefined) return cache;
  try {
    cache = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  } catch {
    cache = null;
  }
  return cache;
}

/** L'interstitiel doit-il être montré ? (version de contenu jamais vue sur cet appareil) */
export function doitMontrerInterstitiel(): boolean {
  return read() !== PARCOURS_VERSION;
}

/** Marque la version courante comme vue (à l'ouverture OU à la fermeture de l'interstitiel). */
export function marquerInterstitielVu(): void {
  cache = PARCOURS_VERSION;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, PARCOURS_VERSION);
  } catch {
    /* fallback mémoire */
  }
}

/** Hook : true au 1er rendu si l'interstitiel doit s'afficher (lu une seule fois). */
export function useInterstitielParcours(): boolean {
  const [montrer] = useState(doitMontrerInterstitiel);
  useEffect(() => {
    if (montrer) marquerInterstitielVu(); // vu = proposé : ne pas re-proposer
  }, [montrer]);
  return montrer;
}
