import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import type { PositionGroupe, Reponse } from "./score";

// Quatre blocs (mêmes que le détecteur) pour formuler l'alignement en clair.
const BLOCS: Record<string, string[]> = {
  GAUCHE: ["LFI-NFP", "GDR", "ECOS", "SOC"],
  CENTRE: ["DEM", "EPR", "HOR", "LIOT"],
  DROITE: ["DR", "UDDPLR"],
  RN: ["RN"],
};
const blocDe = (abrev: string): string | null => {
  for (const b of Object.keys(BLOCS)) if (BLOCS[b].includes(abrev)) return b;
  return null;
};

/**
 * Phrase auto « Ton vote rejoint … » déduite des positions des groupes et de la réponse.
 * `seats` = sièges par abrev (nb_deputes) pour détecter une majorité large.
 */
export function phraseAlignement(
  positions: Record<string, PositionGroupe>,
  rep: Reponse,
  seats: Record<string, number>
): string {
  if (rep !== "pour" && rep !== "contre") return "Tu n'as pas pris position sur ce vote.";
  const opp = rep === "pour" ? "contre" : "pour";

  const meme: string[] = [];
  const autre: string[] = [];
  for (const abrev of ORDRE_HEMICYCLE) {
    const p = positions[abrev];
    if (p === rep) meme.push(abrev);
    else if (p === opp) autre.push(abrev);
  }
  if (!meme.length) return "Ton vote est minoritaire : aucun groupe n'a voté comme toi.";

  const s = (a: string) => seats[a] ?? 0;
  const sMeme = meme.reduce((t, a) => t + s(a), 0);
  const sAutre = autre.reduce((t, a) => t + s(a), 0);
  if (sMeme / (sMeme + sAutre || 1) >= 0.75) return "Ton vote rejoint une majorité large de l'Assemblée.";

  const blocs = new Set(meme.map(blocDe).filter(Boolean) as string[]);
  const has = (b: string) => blocs.has(b);

  if (has("GAUCHE") && has("RN") && !has("CENTRE")) return "Ton vote réunit des bancs opposés (gauche et RN) — un clivage transpartisan.";
  if (blocs.size === 1) {
    if (has("GAUCHE")) return "Ton vote rejoint la gauche.";
    if (has("CENTRE")) return "Ton vote rejoint le centre.";
    if (has("DROITE")) return "Ton vote rejoint la droite.";
    if (has("RN")) return "Ton vote rejoint le RN.";
  }
  if (has("DROITE") && has("RN") && !has("GAUCHE") && !has("CENTRE")) return "Ton vote rejoint la droite et le RN.";
  if (has("GAUCHE") && has("CENTRE") && !has("DROITE") && !has("RN")) return "Ton vote rejoint la gauche et le centre.";
  if (has("CENTRE") && has("DROITE") && !has("GAUCHE")) return "Ton vote rejoint le centre et la droite.";

  return "Ton vote rejoint " + meme.slice(0, 4).join(", ") + (meme.length > 4 ? "…" : "") + ".";
}
