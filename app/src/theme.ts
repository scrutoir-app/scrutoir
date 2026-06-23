// Design system "Scrutoir" — palette neutre (encre + gris froid), la couleur n'encode
// que la DONNÉE de vote (jamais un parti). Deux thèmes : clair (LIGHT) et sombre (DARK).
// `C` est une palette VIVANTE : `applyScheme()` réécrit ses clés, et l'app remonte l'arbre
// au changement (cf. ThemeProvider) → tous les composants qui lisent `C.x` se mettent à jour
// sans changer leurs imports.

export type Scheme = "light" | "dark";

// Palette CLAIRE (par défaut historique).
export const LIGHT = {
  bg: "#F2F4F7", // fond froid clair
  surface: "#FFFFFF", // cartes
  surfaceAlt: "#E6E9EE", // fonds de contrôles (segmented...)
  surfaceSunken: "#EEF0F3", // pistes de barres
  border: "#EAEDF1",
  borderStrong: "#DCE0E6",

  text: "#171A1F",
  textMuted: "#6B727E",
  textFaint: "#A0A6B0",

  accent: "#3C4654", // ardoise neutre (actions, états actifs)
  accentSoft: "#EAEDF1",

  // Sémantique de vote (tons sourds, lecture "donnée")
  pour: "#4F9D83",
  contre: "#CC715E",
  abstention: "#D6A24B",
  absent: "#C7CBD2",

  // Loyauté (réutilise la sémantique, en plus doux)
  loyalHaut: "#4F9D83",
  loyalHautBg: "#E8F1EC",
  loyalMoyen: "#B07E2E",
  loyalMoyenBg: "#F6EFDF",
  loyalBas: "#BC6A4E",
  loyalBasBg: "#F7EAE6",

  // Résultat de scrutin
  adopteBg: "#E8F1EC",
  adopteFg: "#3C7A5E",
  rejeteBg: "#F7EAE6",
  rejeteFg: "#B05A45",

  // Filets / motifs dérivés (filigrane hero, pistes des barres divergentes)
  watermarkInk: "rgba(23,26,31,0.07)",
  watermarkFocal: "rgba(60,70,84,0.13)",
  hairline: "rgba(60,70,84,0.10)",
  hairlineStrong: "rgba(60,70,84,0.40)",
};

// Palette SOMBRE — même langage, couleurs de vote relevées pour rester lisibles.
export const DARK: typeof LIGHT = {
  bg: "#0F1318", // encre froide profonde
  surface: "#191E26", // cartes (au-dessus du fond)
  surfaceAlt: "#252C35", // fonds de contrôles
  surfaceSunken: "#20272F", // pistes de barres
  border: "#272F39",
  borderStrong: "#363F4B",

  text: "#EAEDF1",
  textMuted: "#9AA2AE",
  textFaint: "#697079",

  accent: "#8A93A1", // ardoise claire (lisible en texte ET en fond d'action)
  accentSoft: "#252C35",

  pour: "#57A98D",
  contre: "#D17F6B",
  abstention: "#DCAA55",
  absent: "#565E69",

  loyalHaut: "#57A98D",
  loyalHautBg: "#16302A",
  loyalMoyen: "#C99B55",
  loyalMoyenBg: "#322A19",
  loyalBas: "#D08066",
  loyalBasBg: "#392019",

  adopteBg: "#16302A",
  adopteFg: "#74CFAC",
  rejeteBg: "#3A201B",
  rejeteFg: "#E2917C",

  watermarkInk: "rgba(255,255,255,0.06)",
  watermarkFocal: "rgba(255,255,255,0.11)",
  hairline: "rgba(255,255,255,0.09)",
  hairlineStrong: "rgba(255,255,255,0.35)",
};

// Familles de police Manrope (chargées dans App via useFonts)
export const F = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extra: "Manrope_800ExtraBold",
};

export const RADIUS = { sm: 10, md: 14, lg: 18, xl: 22, pill: 999 };

const SHADOW_LIGHT = { shadowColor: "#141822", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 };
const SHADOW_DARK = { shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 };

// Palette VIVANTE + ombre vivante (réécrites par applyScheme).
export const C = { ...LIGHT };
export const shadowCard = { ...SHADOW_LIGHT };

let _scheme: Scheme = "light";
export const getScheme = (): Scheme => _scheme;

/** Réécrit la palette vivante `C` + `shadowCard` selon le thème. */
export function applyScheme(scheme: Scheme): void {
  _scheme = scheme;
  Object.assign(C, scheme === "dark" ? DARK : LIGHT);
  Object.assign(shadowCard, scheme === "dark" ? SHADOW_DARK : SHADOW_LIGHT);
}

// --- Préférence persistée (localStorage web ; mémoire ailleurs) -----------------
export type SchemePref = "light" | "dark" | "auto";
const PREF_KEY = "scrutoir.scheme";

export function getStoredPref(): SchemePref {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(PREF_KEY) : null;
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch { /* mémoire */ }
  return "light"; // défaut : clair (l'utilisateur opte pour sombre/auto)
}
export function setStoredPref(p: SchemePref): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(PREF_KEY, p); } catch { /* mémoire */ }
}

/** Scheme système au chargement (web) — pour résoudre "auto" dès le 1er rendu. */
export function systemSchemeAtLoad(): Scheme {
  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  } catch { /* ignore */ }
  return "light";
}

// Applique le bon thème dès l'import (avant le 1er rendu) pour éviter un flash.
{
  const pref = getStoredPref();
  applyScheme(pref === "auto" ? systemSchemeAtLoad() : pref);
}

export function couleurLoyaute(pct: number | null): { fg: string; bg: string } {
  if (pct == null) return { fg: C.textMuted, bg: C.surfaceAlt };
  if (pct >= 90) return { fg: C.loyalHaut, bg: C.loyalHautBg };
  if (pct >= 75) return { fg: C.loyalMoyen, bg: C.loyalMoyenBg };
  return { fg: C.loyalBas, bg: C.loyalBasBg };
}

export function libelleLoyaute(pct: number | null): string {
  if (pct == null) return "Loyauté indéterminée";
  if (pct >= 90) return "Suit la ligne du groupe";
  if (pct >= 75) return "S'écarte parfois de la ligne";
  return "Vote souvent contre sa ligne";
}

export function positionLabel(p: string | null): string {
  switch (p) {
    case "pour": return "Pour";
    case "contre": return "Contre";
    case "abstention": return "Abstention";
    case "nonvotant": return "Non votant";
    case "absent": return "Absent";
    default: return "—";
  }
}

export function couleurPosition(p: string): string {
  switch (p) {
    case "pour": return C.pour;
    case "contre": return C.contre;
    case "abstention": return C.abstention;
    default: return C.absent;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${Number(d)} ${mois[Number(m) - 1] ?? ""} ${y}`;
}
