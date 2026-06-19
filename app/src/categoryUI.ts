// Habillage des catégories : icône (MaterialCommunityIcons) + teinte douce neutre.
// Teintes désaturées volontairement — distinction visuelle sans connotation partisane.

export interface CatUI {
  icon: string; // nom MaterialCommunityIcons
  bg: string;
  fg: string;
}

const FALLBACK: CatUI = { icon: "vote-outline", bg: "#ECEEF1", fg: "#5B6675" };

const MAP: Record<string, CatUI> = {
  ecologie: { icon: "leaf", bg: "#EAF1EC", fg: "#4F8A63" },
  "securite-justice": { icon: "shield-half-full", bg: "#ECEFF4", fg: "#5B6675" },
  economie: { icon: "currency-eur", bg: "#F4EFE6", fg: "#A4823F" },
  travail: { icon: "briefcase-variant", bg: "#EDEFEA", fg: "#6E7A52" },
  sante: { icon: "heart-pulse", bg: "#F3ECEF", fg: "#A35F76" },
  education: { icon: "school", bg: "#EAEFF3", fg: "#4E7B96" },
  immigration: { icon: "passport", bg: "#EFEDE9", fg: "#8A7A63" },
  solidarites: { icon: "hand-heart", bg: "#F3EDEC", fg: "#A06A5E" },
  institutions: { icon: "bank", bg: "#ECEEF5", fg: "#5E6488" },
  agriculture: { icon: "tractor-variant", bg: "#EFF1E8", fg: "#7A8A4A" },
  "international-defense": { icon: "shield-star", bg: "#EBF0F1", fg: "#4E7E84" },
  logement: { icon: "home-city", bg: "#F0EDE9", fg: "#8A6F5A" },
};

export function catUI(id: string): CatUI {
  return MAP[id] ?? FALLBACK;
}
