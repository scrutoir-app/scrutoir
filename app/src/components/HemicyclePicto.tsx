import React, { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";

/**
 * Pictogramme : situe un groupe parlementaire sur un hémicycle miniature, en
 * réutilisant la géométrie EXACTE du `ScrutoirMark` (deux rangs de sièges, même
 * formule). Les points du groupe `activeAbrev` sont en `color`, les autres en gris
 * neutre. Le placement gauche→droite suit `ORDRE_HEMICYCLE` (priorité à la position
 * sur l'axe, pas au volume) et garantit au moins un siège par groupe ordonné présent.
 */

// Ordre gauche → droite (SEULE source de placement — éditer ici si besoin). Clé = abrev.
// NI et tout groupe hors liste : pas de mise en avant (points gris).
const ORDRE_HEMICYCLE = ["LFI-NFP", "GDR", "ECOS", "SOC", "LIOT", "DEM", "EPR", "HOR", "DR", "UDDPLR", "RN"];

// Métadonnées des points, indépendantes de la taille (mêmes rangs que le mark).
// f = position gauche→droite (0 = extrême gauche, 1 = extrême droite) = 1 - i/n.
const POINTS_META: { ri: number; frac: number; f: number }[] = (() => {
  const out: { ri: number; frac: number; f: number }[] = [];
  [0, 1].forEach((ri) => {
    const n = 9 - ri * 2; // 9 puis 7
    for (let i = 0; i <= n; i++) out.push({ ri, frac: i / n, f: 1 - i / n });
  });
  return out;
})();

// Affectation des points aux groupes : ne dépend que de l'ensemble des groupes et de
// l'ordre (pas de la taille) → calculée UNE fois et mémorisée (cache module partagé
// par toutes les lignes). Retourne, pour chaque point (ordre POINTS_META), l'abrev du
// groupe propriétaire (ou null si aucun groupe ordonné présent).
const ownerCache = new Map<string, (string | null)[]>();

function ownersFor(groupes: { abrev: string | null; nb_deputes: number }[]): (string | null)[] {
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

    // Garantie d'un siège minimum : un groupe sans point vole le point le plus proche de
    // son mid, de préférence à un groupe qui en a plus d'un (sinon le plus proche quand même).
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

export function HemicyclePicto({
  groupes,
  activeAbrev,
  color,
  size = 46,
}: {
  groupes: { abrev: string | null; nb_deputes: number }[];
  activeAbrev: string | null;
  color: string;
  size?: number;
}) {
  const w = size;
  const h = size * 0.72;
  const cx = w / 2;
  const cy = h * 0.84;
  const dotR = Math.max(1, size * 0.046);

  // Placement : mémorisé sur la liste des groupes (cache module → calculé une seule fois).
  const ownerAbrev = useMemo(() => ownersFor(groupes), [groupes]);

  // Coordonnées des points : ne dépendent que de la taille (même formule que le mark).
  const points = useMemo(() => {
    const rings = [w * 0.44, w * 0.31];
    return POINTS_META.map((p) => {
      const R = rings[p.ri];
      const t = Math.PI * p.frac;
      return { x: cx + R * Math.cos(t), y: cy - R * Math.sin(t) };
    });
  }, [size]);

  return (
    <Svg width={w} height={h}>
      {points.map((d, i) => (
        <Circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={dotR}
          fill={ownerAbrev[i] && ownerAbrev[i] === activeAbrev ? color : "#D2D6DE"}
        />
      ))}
      {/* Point focal central, neutre (≠ accent du mark) */}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill="#AEB4BE" />
    </Svg>
  );
}
