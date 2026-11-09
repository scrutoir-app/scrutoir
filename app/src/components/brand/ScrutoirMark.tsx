import React from "react";
import Svg, { Circle } from "react-native-svg";
import { C, getScheme } from "../../theme";
import { geometrieMarque } from "./geometrie";

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
  const { w, h, dots, dotR, strokeW, focal } = geometrieMarque(size, whiteSeat, whiteSeatRing, whiteSeatIndex);
  // En sombre, on VIDE l'intérieur du siège blanc (jumeau du point du i) et du rond focal :
  // remplissage = couleur de fond → on voit le fond sombre à travers (contour conservé).
  const dark = getScheme() === "dark";
  const evide = dark ? C.bg : null;

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
      <Circle cx={focal.x} cy={focal.y} r={focal.r} fill={dark ? "#FFFFFF" : accent} />
    </Svg>
  );
}
