import React from "react";
import Svg, { Circle } from "react-native-svg";
import { C, getScheme } from "../../theme";

/**
 * NOUVELLE VERSION du picto Scrutoir (juin 2026).
 * L'ancien composant sans siège blanc reste à src/components/ScrutoirMark.tsx.
 *
 * Hémicycle vu du dessus, point focal central (tribune / pupille, racine scrut-).
 * Un siège du flanc droit (rang extérieur, index 2) est blanc contour encre,
 * jumeau du point du i du logotype. Désactivable via whiteSeat={false} en favicon.
 */
export function ScrutoirMark({
  size = 40,
  color = C.text,
  accent = C.accent,
  whiteSeat = true,
  whiteSeatRing = 0,
  whiteSeatIndex = 2,
}: {
  size?: number;
  color?: string;
  accent?: string;
  whiteSeat?: boolean;
  whiteSeatRing?: number;
  whiteSeatIndex?: number;
}) {
  const w = size;
  const h = size * 0.72;
  const cx = w / 2;
  const cy = h * 0.84;
  const rings = [w * 0.44, w * 0.31];
  const dotR = Math.max(1, size * 0.046);
  const strokeW = Math.max(1, size * 0.0085);
  // En sombre, on VIDE l'intérieur du siège blanc (jumeau du point du i) et du rond focal :
  // remplissage = couleur de fond → on voit le fond sombre à travers (contour conservé).
  const dark = getScheme() === "dark";
  const evide = dark ? C.bg : null;

  const dots: { x: number; y: number; white: boolean }[] = [];
  rings.forEach((R, ri) => {
    const n = 9 - ri * 2;
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (i / n);
      const white = whiteSeat && ri === whiteSeatRing && i === whiteSeatIndex;
      dots.push({ x: cx + R * Math.cos(t), y: cy - R * Math.sin(t), white });
    }
  });

  return (
    <Svg width={w} height={h}>
      {dots.map((d, i) =>
        d.white ? (
          <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={evide ?? "#FFFFFF"} stroke={color} strokeWidth={strokeW} />
        ) : (
          <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={color} />
        )
      )}
      {/* Point focal : disque PLEIN. En clair = ardoise (accent) ; en sombre = blanc, pour
          être le vrai NÉGATIF du logo clair (≠ creux). */}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill={dark ? "#FFFFFF" : accent} />
    </Svg>
  );
}
