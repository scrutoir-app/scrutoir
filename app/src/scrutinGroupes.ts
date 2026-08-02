import { useEffect, useState } from "react";
import { getScrutin } from "./api";
import { groupesPos, type GroupePos } from "./testProximite/verdict";
import type { GroupeVentilation } from "./types";

/**
 * Détail « groupes » d'un scrutin (positions + tailles par groupe), source des couleurs de
 * l'hémicycle par position, des camps, et du verdict DÉDUIT. Fichier `scrutin/<uid>.json`
 * immuable → mis en cache par la couche `api.j()` : appelé par plusieurs cartes, il n'est
 * chargé qu'une fois. Le rendu de la carte reste instantané (index) ; ceci l'enrichit.
 */
export interface ScrutinGroupes {
  groupes: GroupeVentilation[];
  pos: GroupePos[];
}

export function useScrutinGroupes(uid: string): ScrutinGroupes | null {
  const [d, setD] = useState<ScrutinGroupes | null>(null);
  useEffect(() => {
    let vivant = true;
    getScrutin(uid)
      .then((det) => { if (vivant) setD({ groupes: det.groupes, pos: groupesPos(det.groupes) }); })
      .catch(() => vivant && setD(null));
    return () => { vivant = false; };
  }, [uid]);
  return d;
}
