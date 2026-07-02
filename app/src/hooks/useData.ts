import { useCallback, useEffect, useState } from "react";

/**
 * Chargement de données statiques avec VRAI état d'erreur (fin des pages blanches).
 *
 * Remplace le pattern répété `useEffect + vivant + .then/.finally sans .catch` des
 * écrans : ici un échec réseau (hors-ligne, 404, JSON invalide) produit `error`,
 * que l'écran affiche via <ErreurChargement onRetry={retry} /> au lieu de rendre
 * `null` en silence. `retry` relance le fetch (la couche api.ts ne mémorise pas
 * les promesses rejetées, donc un nouvel essai repart bien sur le réseau).
 *
 * `fetcher` doit être stable par rapport à `deps` (il est recréé par l'écran à
 * chaque render ; seuls `deps` déclenchent un rechargement, comme un useEffect).
 * Sur rechargement (changement de deps), `data` est conservé pour éviter le
 * flash — à l'écran de décider avec `loading` (spinner si `!data`).
 */
export function useData<T>(fetcher: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((d) => {
        if (vivant) setData(d);
      })
      .catch((e) => {
        if (vivant) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (vivant) setLoading(false);
      });
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, essai]);

  const retry = useCallback(() => setEssai((n) => n + 1), []);
  return { data, loading, error, retry };
}
