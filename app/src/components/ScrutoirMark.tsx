import React from "react";
import Svg, { Circle } from "react-native-svg";
import { C } from "../theme";

/**
 * Marque Scrutoir : un hémicycle vu du dessus (arcs de sièges = la chambre) avec un
 * point focal central. Double lecture : la tribune / le perchoir au centre de
 * l'hémicycle, et une « pupille » sous une voûte — l'observation (racine scrut-).
 */
export function ScrutoirMark({
  size = 40,
  color = C.text,
  accent = C.accent,
}: {
  size?: number;
  color?: string;
  accent?: string;
}) {
  const w = size;
  const h = size * 0.72;
  const cx = w / 2;
  const cy = h * 0.84; // ligne de base de l'hémicycle (et centre du point focal)
  const rings = [w * 0.44, w * 0.31]; // deux rangs de sièges
  const dotR = Math.max(1, size * 0.046);

  const dots: { x: number; y: number }[] = [];
  rings.forEach((R, ri) => {
    const n = 9 - ri * 2; // moins de sièges sur le rang intérieur
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (i / n); // 0..π → demi-cercle
      dots.push({ x: cx + R * Math.cos(t), y: cy - R * Math.sin(t) });
    }
  });

  return (
    <Svg width={w} height={h}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={color} />
      ))}
      {/* Point focal : tribune / pupille */}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill={accent} />
    </Svg>
  );
}
