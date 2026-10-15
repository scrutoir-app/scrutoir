import { useEffect, useState } from "react";
import { semantiqueAutorisee, autoriserSemantique, modeleDejaEnCache, stockageSuffisant } from "../search/consent";

/**
 * Recherche par sujet : consentement au modèle (~120 Mo) et progression de son téléchargement.
 * Mêmes règles que la recherche de l'accueil (`SearchResultsList`) : le modèle n'est JAMAIS
 * téléchargé sans l'accord de l'utilisateur ; un modèle déjà en cache vaut accord.
 *  · `active` : null = vérification du cache en cours ; false = repli lexical seul.
 *  · `activer()` : vérifie la place, mémorise l'accord, puis passe `active` à true.
 */
export function useSemantique() {
  const [active, setActive] = useState<boolean | null>(null);
  const [stockKo, setStockKo] = useState(false);
  const [progres, setProgres] = useState<{ loaded: number; total: number } | null>(null);

  useEffect(() => {
    if (semantiqueAutorisee()) {
      setActive(true);
      return;
    }
    let vivant = true;
    modeleDejaEnCache().then((ok) => vivant && setActive(ok));
    return () => {
      vivant = false;
    };
  }, []);

  // Progression du téléchargement du modèle, annoncée par le service worker.
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.type === "scrutoir:model-progress") setProgres({ loaded: d.loaded, total: d.total });
    };
    sw.addEventListener("message", onMsg);
    return () => sw.removeEventListener("message", onMsg);
  }, []);

  const activer = async () => {
    if (!(await stockageSuffisant())) {
      setStockKo(true);
      return;
    }
    await autoriserSemantique();
    setActive(true);
  };

  return { active, stockKo, progres, activer };
}
