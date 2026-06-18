export const C = {
  bg: "#F7F7F5",
  surface: "#FFFFFF",
  surfaceAlt: "#F1EFE8",
  border: "#E3E1D9",
  text: "#1B1B19",
  textMuted: "#6B6A64",
  textFaint: "#9B9A92",

  pour: "#639922",
  contre: "#E24B4A",
  abstention: "#EF9F27",
  absent: "#B4B2A9",

  loyalHaut: "#3B6D11",
  loyalHautBg: "#EAF3DE",
  loyalMoyen: "#854F0B",
  loyalMoyenBg: "#FAEEDA",
  loyalBas: "#A32D2D",
  loyalBasBg: "#FCEBEB",

  accent: "#185FA5",
  accentBg: "#E6F1FB",
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

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return `${Number(d)} ${mois[Number(m) - 1] ?? ""} ${y}`;
}
