import React from "react";
import Svg, { Circle } from "react-native-svg";
import { C } from "../theme";

/** Logo : l'hémicycle vu du dessus, en arc de points (sièges). Sert aussi d'icône. */
export function HemicycleMark({ size = 40, color = C.text }: { size?: number; color?: string }) {
  const w = size;
  const h = size * 0.66;
  const cx = w / 2;
  const cy = h * 0.92;
  const radii = [w * 0.43, w * 0.30, w * 0.17];
  const dotR = Math.max(1, size * 0.038);

  const dots: { x: number; y: number }[] = [];
  radii.forEach((R, ri) => {
    const n = 6 + ri * 3;
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (i / n); // 0..π → demi-cercle (arc des sièges)
      dots.push({ x: cx + R * Math.cos(t), y: cy - R * Math.sin(t) });
    }
  });

  return (
    <Svg width={w} height={h}>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={color} />
      ))}
    </Svg>
  );
}
