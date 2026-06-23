import React, { createContext, useContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { applyScheme, getStoredPref, setStoredPref, systemSchemeAtLoad, type Scheme, type SchemePref } from "./theme";

interface ThemeModeCtx {
  pref: SchemePref; // choix utilisateur : clair / sombre / auto
  effective: Scheme; // thème réellement appliqué (auto → résolu via le système)
  setPref: (p: SchemePref) => void;
}

const Ctx = createContext<ThemeModeCtx>({ pref: "light", effective: "light", setPref: () => {} });

export function useThemeMode(): ThemeModeCtx {
  return useContext(Ctx);
}

/**
 * Fournit le thème clair/sombre. « auto » suit le système (`useColorScheme`).
 * On réécrit la palette vivante (`applyScheme`) AVANT de rendre les enfants, et l'app
 * remonte son arbre via `key={effective}` (cf. App) → tous les composants se mettent à jour.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<SchemePref>(() => getStoredPref());
  const system = useColorScheme(); // "light" | "dark" | null
  const effective: Scheme = pref === "auto" ? ((system ?? systemSchemeAtLoad()) as Scheme) : pref;

  applyScheme(effective); // idempotent : sûr en cours de rendu

  const setPref = (p: SchemePref) => { setStoredPref(p); setPrefState(p); };
  const value = useMemo(() => ({ pref, effective, setPref }), [pref, effective]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
