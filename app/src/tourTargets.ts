import { useCallback } from "react";

/**
 * Registre des ZONES de l'accueil pointées par la visite guidée. L'overlay `TourNavigation`
 * est rendu au niveau de l'App (là où vit la barre d'onglets), mais certaines cibles vivent
 * DANS l'accueil (recherche, héro, DUO, « Trouver ton député », activité). Ce petit store
 * module — même mécanique que `tour.ts` / `tabRefs` — laisse l'accueil enregistrer ses
 * nœuds mesurables par clé, et l'App les relire pour construire les pas. Aucune persistance :
 * les nœuds sont éphémères (montés/démontés avec l'écran).
 */
export type CibleTour = "recherche" | "hero" | "espace" | "depute" | "activite";

const nodes: Partial<Record<CibleTour, any>> = {};

/** Nœud enregistré pour une clé (ou undefined si la zone n'est pas montée). */
export function getCibleTour(cle: CibleTour): any {
  return nodes[cle];
}

/**
 * Callback ref STABLE (mémoïsé par clé) à poser sur la zone : `ref={useCibleTour("hero")}`.
 * Enregistre le nœud au montage, le retire au démontage — sans re-render en boucle (l'App lit
 * le registre au moment où la visite s'ouvre, elle n'a pas besoin d'un abonnement réactif).
 */
export function useCibleTour(cle: CibleTour): (node: any) => void {
  return useCallback(
    (node: any) => {
      if (node) nodes[cle] = node;
      else delete nodes[cle];
    },
    [cle],
  );
}
