import { useMemo, useSyncExternalStore } from "react";
import { abonnerTest, chargerTest, versionTest, type EtatTest } from "./storage";
import type { Reponse } from "./score";

// Lecture RÉACTIVE de l'état du test : une réponse posée ou effacée depuis le tiroir de vote
// met à jour, sans changer d'écran, toutes les pastilles et tous les « je » affichés.
// (storage.ts reste sans React : il expose un compteur de version et des écouteurs.)

/** Version courante de l'état du test (change à chaque écriture). */
export function useVersionTest(): number {
  return useSyncExternalStore(abonnerTest, versionTest, versionTest);
}

/** État du test stocké sur l'appareil (null si rien), relu à chaque changement. */
export function useEtatTest(): EtatTest | null {
  const v = useVersionTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => chargerTest(), [v]);
}

/** Réponses stockées (par n° de scrutin), relues à chaque changement. */
export function useReponses(): Record<number, Reponse> {
  const etat = useEtatTest();
  return useMemo(() => etat?.reponses ?? {}, [etat]);
}
