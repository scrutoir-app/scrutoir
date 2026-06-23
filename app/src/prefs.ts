import { useEffect, useState } from "react";

/**
 * Préférences d'affichage locales (sur l'appareil, comme les suivis). Même mécanique
 * que follows.ts : un petit store + listeners + hook réactif, sans provider.
 *
 * `partyLogos` : afficher les logos officiels des groupes (opt-in) à la place des sigles.
 * Défaut = false → sigles lisibles (comportement de prod). C'est un choix UTILISATEUR :
 * il décide d'afficher des logos partisans dans son espace, ça n'engage pas la plateforme.
 */
const KEY = "scrutoir.partyLogos";
let cache: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cache !== null) return cache;
  try {
    cache = typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1";
  } catch {
    cache = false;
  }
  return cache;
}

export function getPartyLogos(): boolean {
  return read();
}

export function setPartyLogos(on: boolean): void {
  cache = on;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* fallback mémoire */
  }
  listeners.forEach((l) => l());
}

/** Hook réactif : [activé, setActivé]. */
export function usePartyLogos(): [boolean, (on: boolean) => void] {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return [read(), setPartyLogos];
}
