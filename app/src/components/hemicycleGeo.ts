// Géométrie et affectation partagées de l'hémicycle (réutilisées par HemicyclePicto,
// IntroQuestionMark…). Reprend EXACTEMENT la géométrie de ScrutoirMark (non modifié) :
// deux rangs de sièges, mêmes formules. Une seule source pour l'ordre gauche→droite et
// le placement des points par groupe.

// Ordre gauche → droite (clé = abrev RÉEL en base). ⚠️ LFI-NFP / UDDPLR, pas LFI/UDR
// (le spec les abrège ; les composants reçoivent les abrevs réels des groupes).
export const ORDRE_HEMICYCLE = ["LFI-NFP", "GDR", "ECOS", "SOC", "LIOT", "DEM", "EPR", "HOR", "DR", "UDDPLR", "RN"];

export interface GroupeGeo {
  abrev: string | null;
  nb_deputes: number;
}

// Métadonnées des points (2 rangs du mark), indépendantes de la taille.
// f = position gauche→droite (0 = extrême gauche, 1 = extrême droite) = 1 - i/n.
export const POINTS_META: { ri: number; frac: number; f: number }[] = (() => {
  const out: { ri: number; frac: number; f: number }[] = [];
  [0, 1].forEach((ri) => {
    const n = 9 - 2 * ri; // 9 puis 7
    for (let i = 0; i <= n; i++) out.push({ ri, frac: i / n, f: 1 - i / n });
  });
  return out;
})();

/** Géométrie du mark à une taille donnée (identique à ScrutoirMark). */
export function markGeo(size: number) {
  const w = size;
  const h = size * 0.72;
  const cx = w / 2;
  const cy = h * 0.84; // ligne de base de la coupole
  const rings = [w * 0.44, w * 0.31];
  const dotR = Math.max(1, size * 0.046);
  return { w, h, cx, cy, rings, dotR };
}

/** Coordonnées des points de la coupole à une taille donnée. */
export function coupolePoints(size: number): { x: number; y: number; f: number; ri: number }[] {
  const { cx, cy, rings } = markGeo(size);
  return POINTS_META.map((p) => {
    const R = rings[p.ri];
    const t = Math.PI * p.frac;
    return { x: cx + R * Math.cos(t), y: cy - R * Math.sin(t), f: p.f, ri: p.ri };
  });
}

// Affectation des points aux groupes : ne dépend que de l'ensemble des groupes et de
// l'ordre (pas de la taille) → calculée UNE fois et mémorisée (cache module). Retourne,
// pour chaque point (ordre POINTS_META), l'abrev du groupe propriétaire (ou null).
const ownerCache = new Map<string, (string | null)[]>();

export function ownersFor(groupes: GroupeGeo[]): (string | null)[] {
  const ordered = groupes
    .filter((g) => g.abrev && ORDRE_HEMICYCLE.includes(g.abrev))
    .sort((a, b) => ORDRE_HEMICYCLE.indexOf(a.abrev!) - ORDRE_HEMICYCLE.indexOf(b.abrev!));

  const sig = ordered.map((g) => `${g.abrev}:${g.nb_deputes}`).join("|");
  const cached = ownerCache.get(sig);
  if (cached) return cached;

  let result: (string | null)[];
  if (!ordered.length) {
    result = POINTS_META.map(() => null);
  } else {
    const total = ordered.reduce((s, g) => s + (g.nb_deputes || 0), 0) || 1;
    const bounds: { s0: number; s1: number; mid: number }[] = [];
    let cum = 0;
    ordered.forEach((g) => {
      const s0 = cum;
      const s1 = cum + (g.nb_deputes || 0);
      bounds.push({ s0, s1, mid: (s0 + s1) / 2 });
      cum = s1;
    });

    const seats = POINTS_META.map((p) => p.f * total);
    // Propriétaire initial : groupe dont [s0, s1) contient le siège (dernier inclus jusqu'à s1).
    const owner = seats.map((seat) => {
      for (let g = 0; g < ordered.length; g++) {
        if (seat >= bounds[g].s0 && (seat < bounds[g].s1 || g === ordered.length - 1)) return g;
      }
      return ordered.length - 1;
    });

    const counts = ordered.map(() => 0);
    owner.forEach((g) => counts[g]++);

    // GARANTIE : un groupe sans point vole le point le plus proche de son centre, de
    // préférence à un groupe qui en a plus d'un (sinon le plus proche quand même).
    for (let g = 0; g < ordered.length; g++) {
      if (counts[g] > 0) continue;
      let bestP = -1;
      let bestD = Infinity;
      let bestStealable = false;
      for (let p = 0; p < POINTS_META.length; p++) {
        const stealable = counts[owner[p]] > 1;
        const d = Math.abs(seats[p] - bounds[g].mid);
        if (stealable && !bestStealable) {
          bestP = p; bestD = d; bestStealable = true;
        } else if (stealable === bestStealable && d < bestD) {
          bestP = p; bestD = d;
        }
      }
      if (bestP >= 0) {
        counts[owner[bestP]]--;
        owner[bestP] = g;
        counts[g]++;
      }
    }

    result = owner.map((g) => ordered[g].abrev!);
  }

  ownerCache.set(sig, result);
  return result;
}
