// Design system "Hémicycle" — app moderne, palette neutre (encre + gris froid),
// la couleur n'encode que la DONNÉE de vote (jamais un parti).

export const C = {
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

// Ombre douce réutilisable (cartes)
export const shadowCard = {
  shadowColor: "#141822",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

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
    case "nonvotant": return "Absent";
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
