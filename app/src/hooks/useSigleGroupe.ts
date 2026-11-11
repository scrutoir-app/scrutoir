import { useEffect, useState } from "react";
import { getPartis } from "../api";
import { abonnerBulle, bulleCourante, indexerGroupes, type Bulle, type GroupeConnu } from "../sigleGroupe";

// Hooks React du sigle dépliable, séparés de `sigleGroupe.ts` qui reste pur (sans React) pour
// les tests lancés depuis pipeline/ (cf. hooks/useKept.ts).

// Index des noms, chargé UNE fois pour toute l'app (partis.json, déjà en cache réseau).
let index: Map<string, GroupeConnu> | null = null;
let chargement: Promise<Map<string, GroupeConnu>> | null = null;

function chargerIndex(): Promise<Map<string, GroupeConnu>> {
  if (!chargement) {
    chargement = getPartis()
      .then((p) => (index = indexerGroupes(p)))
      .catch(() => {
        chargement = null; // nouvel essai au prochain sigle affiché
        return new Map<string, GroupeConnu>();
      });
  }
  return chargement;
}

/** Les groupes connus (sigle → uid + nom complet), ou null tant qu'ils chargent. */
export function useGroupesConnus(): Map<string, GroupeConnu> | null {
  const [idx, setIdx] = useState(index);
  useEffect(() => {
    if (index) return;
    let vivant = true;
    chargerIndex().then((m) => vivant && setIdx(m));
    return () => {
      vivant = false;
    };
  }, []);
  return idx;
}

/** La bulle ouverte (une seule à la fois), ou null. */
export function useBulleSigle(): Bulle | null {
  const [, force] = useState(0);
  useEffect(() => abonnerBulle(() => force((n) => n + 1)), []);
  return bulleCourante();
}
