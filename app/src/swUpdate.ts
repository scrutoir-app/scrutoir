import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { viderCacheDonnees } from "./api";

/**
 * Mise à jour de l'app SANS reload forcé.
 *
 * Le service worker ne fait plus de skipWaiting() automatique (avant : la page se
 * rechargeait en pleine session au déploiement quotidien — un test de proximité en
 * cours était perdu). Ce hook :
 *  - détecte une nouvelle version EN ATTENTE (reg.waiting / updatefound) → l'UI
 *    affiche un bandeau « Mise à jour disponible » ;
 *  - `appliquer()` poste SKIP_WAITING au SW en attente → il s'active →
 *    `controllerchange` → reload (injecté par patch-pwa.mjs), cette fois VOULU ;
 *  - écoute `scrutoir:data-updated` (le SW a purgé les données mutables après un
 *    nouveau déploiement) → vide le cache mémoire d'api.ts, les prochains écrans
 *    lisent les JSON frais sans rien recharger.
 *
 * Inerte hors web / sans SW (dev Expo, natif).
 */
export function useMajApp(): { majDispo: boolean; appliquer: () => void } {
  const [majDispo, setMajDispo] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let vivant = true;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg || !vivant) return;
      if (reg.waiting) setMajDispo(true); // une version attend déjà (installée à une visite précédente)
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", () => {
          // « installed » ALORS QU'un contrôleur est en place = nouvelle version en attente.
          // (Sans contrôleur, c'est la toute première installation : rien à proposer.)
          if (w.state === "installed" && navigator.serviceWorker.controller && vivant) setMajDispo(true);
        });
      });
    });

    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "scrutoir:data-updated") viderCacheDonnees();
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => {
      vivant = false;
      navigator.serviceWorker.removeEventListener("message", onMsg);
    };
  }, []);

  const appliquer = useCallback(() => {
    navigator.serviceWorker.getRegistration().then((reg) => reg?.waiting?.postMessage("SKIP_WAITING"));
  }, []);

  return { majDispo, appliquer };
}
