import React, { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";

/**
 * Hémicycle peuplé de « sièges » = les députés dans la chambre (suggestion simplifiée,
 * façon plan de l'Assemblée). Ancré en bas-centre, ses arcs concentriques balaient toute
 * la carte. Purement décoratif (filigrane), neutre : une seule couleur, aucune sémantique
 * de vote. Dessiné aux dimensions exactes de la carte (clip naturel par le viewBox).
 */
export function HemicycleSeats({
  width,
  height,
  color = "#000",
  pitch = 22, // espacement des sièges (le long de l'arc ET entre rangs)
}: {
  width: number;
  height: number;
  color?: string;
  pitch?: number;
}) {
  const dots = useMemo(() => {
    if (!width || !height) return [];
    const cx = width / 2;
    const cy = height; // perchoir en bas-centre ; le demi-disque s'ouvre vers le haut
    const rMax = Math.hypot(cx, height) + pitch; // assez grand pour atteindre les coins hauts
    const out: { x: number; y: number; r: number }[] = [];
    const dotR = Math.max(1.6, width * 0.0045);
    for (let R = pitch * 1.3; R <= rMax; R += pitch) {
      const n = Math.max(4, Math.round((Math.PI * R) / pitch)); // + de sièges sur les rangs extérieurs
      for (let k = 0; k <= n; k++) {
        const t = Math.PI * (k / n); // 0..π → demi-cercle
        const x = cx + R * Math.cos(t);
        const y = cy - R * Math.sin(t);
        if (x >= -2 && x <= width + 2 && y >= -2 && y <= height + 2) out.push({ x, y, r: dotR });
      }
    }
    out.push({ x: cx, y: cy - dotR * 1.5, r: dotR * 2.3 }); // point focal (perchoir / tribune)
    return out;
  }, [width, height, pitch]);

  if (!width || !height) return null;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} />
      ))}
    </Svg>
  );
}
