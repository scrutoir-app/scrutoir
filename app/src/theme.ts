// Design system "Scrutoir" — palette neutre (encre + gris froid), la couleur n'encode
// que la DONNÉE de vote (jamais un parti). Deux thèmes : clair (LIGHT) et sombre (DARK).
// `C` est une palette VIVANTE : `applyScheme()` réécrit ses clés, et l'app remonte l'arbre
// au changement (cf. ThemeProvider) → tous les composants qui lisent `C.x` se mettent à jour
// sans changer leurs imports.

import type { TextStyle } from "react-native";

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
  // Contrastes WCAG AA (≥ 4,5:1 sur fond #F2F4F7 ET sur cartes blanches) : textFaint
  // porte du texte de SENS (labels d'onglets inactifs, captions, messages) — l'ancien
  // #A0A6B0 tombait à 2,4:1. Hiérarchie conservée : text > textMuted > textFaint.
  textMuted: "#5B626E",
  textFaint: "#68707C",

  accent: "#3C4654", // ardoise neutre (actions, états actifs)
  accentSoft: "#EAEDF1",
  // Fond de la carte Duels : quasi-noir, ALIGNÉ sur le héros « Sur quoi ils ont voté ? »
  // (cf. heroTokens) → les deux cartes sombres de l'accueil sont cohérentes. Texte blanc
  // lisible dans les deux modes. Toujours neutre, jamais une couleur de parti.
  duelBg: "#161A20",
  // Tuiles internes de la carte Duels : un cran clair NET au-dessus du fond (solide, pas un
  // voile translucide qui compositerait différemment selon le fond). Calé par mode pour un
  // rendu identique en clair et sombre.
  duelTileBg: "#2A313C",
  duelTileBorder: "#3A4350",

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

  // Sièges neutres du PictoGroupe (non colorés) + point focal central — déclinés par mode.
  siege: "#D2D6DE",
  siegeFocal: "#AEB4BE",
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
  // Idem clair : ≥ 4,5:1 sur fond #0F1318 ET sur cartes #191E26 (ancien #697079 : 3,5:1).
  textFaint: "#8A919B",

  accent: "#8A93A1", // ardoise claire (lisible en texte ET en fond d'action)
  accentSoft: "#252C35",
  duelBg: "#2A323E", // aligné sur le héros sombre (heroTokens) — texte blanc lisible
  duelTileBg: "#39424F", // tuiles : un cran clair au-dessus du fond sombre
  duelTileBorder: "#49535F",

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

  // Sièges neutres + focal en sombre (gris froids relevés, lisibles sur fond encre).
  siege: "#39424E",
  siegeFocal: "#5A6573",
};

// Familles de police Manrope (chargées dans App via useFonts)
export const F = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extra: "Manrope_800ExtraBold",
};

// Échelle typographique — 5 TAILLES distinctes : 11 · 13 · 15 · 18 · 22 (écarts ~1.2,
// hiérarchie qu'on voit). `callout` = même taille que `body` (15) mais en semi-bold :
// c'est la variante d'emphase / sous-titre, PAS une 6ᵉ taille. La FAMILLE d'un cran peut
// être surchargée au cas par cas ; la TAILLE vient toujours d'un cran de T (plancher 11 px).
// S'étale tel quel : style={[T.body, { color: C.textMuted }]}.
export const T = {
  micro:   { fontFamily: F.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0 },
  small:   { fontFamily: F.medium,   fontSize: 13, lineHeight: 17, letterSpacing: 0 },
  body:    { fontFamily: F.medium,   fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  callout: { fontFamily: F.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  heading: { fontFamily: F.bold,     fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  title:   { fontFamily: F.extra,    fontSize: 22, lineHeight: 26, letterSpacing: -0.4 },
} as const;

// Chiffres tabulaires : à étaler sur tout nombre qui s'aligne en colonne ou défile
// (compteurs de votes, pourcentages, nombres de scrutins, dates numériques empilées).
export const tnum: TextStyle = { fontVariant: ["tabular-nums"] };

// Champs de saisie (TextInput) : 16 px MINIMUM — en dessous, iOS Safari zoome
// automatiquement au focus. Ce n'est PAS un cran de hiérarchie, mais une contrainte
// d'interaction : à utiliser pour TOUTE zone de saisie. style={[inputText, { color }]}.
export const inputText: TextStyle = { ...T.body, fontSize: 16 };

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

/**
 * Couleur d'IDENTITÉ d'un groupe, rendue lisible sur fond sombre. En clair : inchangée.
 * En sombre : les couleurs très foncées (RN bleu marine, GDR bordeaux) se fondraient sur
 * le fond encre → on les éclaircit (mélange vers le blanc, proportionnel à leur obscurité).
 * À utiliser partout où la couleur de parti sert d'aplat/identité (picto, barres, pastilles).
 */
export function couleurGroupe(hex: string | null | undefined): string {
  if (!hex) return C.textFaint;
  if (_scheme !== "dark") return hex;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum >= 0.5) return hex; // déjà clair → ne pas délaver
  const t = 0.3 + (0.5 - lum) * 0.7; // plus c'est sombre, plus on éclaircit
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
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
