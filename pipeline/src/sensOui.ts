/**
 * « Sens du oui » d'un scrutin : répondre « oui » à la question revient-il à voter comme la
 * gauche ou comme la droite ? Sert à équilibrer le test de proximité (biais d'acquiescement :
 * en juillet 2026, « oui » rejoignait la droite 26 fois sur 39) et à repérer, à chaque import,
 * les nouveaux scrutins où les blocs s'affrontent vraiment. Fonctions pures, testées à part.
 */

/** Quatre blocs ; l'UDR compte avec le RN (même lecture que le compte rendu du 09/11/2026). */
export const BLOCS_SENS = {
  gauche: ["LFI-NFP", "GDR", "ECOS", "SOC"],
  centre: ["EPR", "DEM", "HOR", "LIOT"],
  DR: ["DR"],
  "RN-UDR": ["RN", "UDR"],
} as const;
export type NomBloc = keyof typeof BLOCS_SENS;
const NOMS = Object.keys(BLOCS_SENS) as NomBloc[];

export type PositionBloc = "pour" | "contre" | "abstention" | "divisé";
export type Compte = { pour: number; contre: number; abstention: number };
export type Blocs = Partial<Record<NomBloc, PositionBloc>>;
export type SensOui = "gauche" | "droite" | "RN" | "anti-RN" | "autre";

/** En dessous, un vote n'est pas proposé comme question : trop peu de députés présents. */
export const VOTANTS_MIN = 120;

/** Position d'un bloc : celle de plus de la moitié de ses votants, sinon « divisé » ; null si absent. */
export function positionBloc(c: Compte): PositionBloc | null {
  const total = c.pour + c.contre + c.abstention;
  if (total === 0) return null;
  for (const p of ["pour", "contre", "abstention"] as const) if (c[p] / total > 0.5) return p;
  return "divisé";
}

/** Positions des quatre blocs à partir des votants de chaque groupe (clé = abréviation). */
export function blocsDuScrutin(parGroupe: ReadonlyMap<string, Compte>): Blocs {
  const out: Blocs = {};
  for (const nom of NOMS) {
    const c: Compte = { pour: 0, contre: 0, abstention: 0 };
    for (const abrev of BLOCS_SENS[nom]) {
      const g = parGroupe.get(abrev);
      if (g) { c.pour += g.pour; c.contre += g.contre; c.abstention += g.abstention; }
    }
    const p = positionBloc(c);
    if (p) out[nom] = p;
  }
  return out;
}

/** Vrai affrontement : au moins un bloc vote pour pendant qu'un autre vote contre. */
export function affrontement(b: Blocs): boolean {
  const positions = Object.values(b);
  return positions.includes("pour") && positions.includes("contre");
}

/**
 * Règles, dans l'ordre (la première qui s'applique) :
 * - « gauche » : la gauche vote pour, DR ou RN-UDR vote contre ;
 * - « droite » : la gauche vote contre, un autre bloc vote pour ;
 * - « RN » / « anti-RN » : RN-UDR seul de son côté (aucun autre bloc avec lui, au moins un en face) ;
 * - « autre » sinon (ex. centre seul contre tous).
 */
export function sensOui(b: Blocs): SensOui {
  const rn = b["RN-UDR"];
  if (b.gauche === "pour" && (b.DR === "contre" || rn === "contre")) return "gauche";
  if (b.gauche === "contre" && (b.centre === "pour" || b.DR === "pour" || rn === "pour")) return "droite";
  if (rn === "pour" || rn === "contre") {
    const autres = (["gauche", "centre", "DR"] as const).map((n) => b[n]).filter((p) => p === "pour" || p === "contre");
    if (autres.length > 0 && autres.every((p) => p !== rn)) return rn === "pour" ? "RN" : "anti-RN";
  }
  return "autre";
}
