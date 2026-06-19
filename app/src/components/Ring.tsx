import React from "react";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { C, F } from "../theme";

/** Anneau de progression avec valeur au centre. */
export function Ring({
  pct,
  color,
  size = 56,
  stroke = 6,
}: {
  pct: number | null;
  color: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct ?? 0));
  const offset = circ * (1 - v / 100);
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.surfaceSunken} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <SvgText
        x={size / 2}
        y={size / 2 + 5}
        fontSize={size * 0.27}
        fontFamily={F.extra}
        fill={C.text}
        textAnchor="middle"
      >
        {pct == null ? "—" : `${pct}%`}
      </SvgText>
    </Svg>
  );
}
