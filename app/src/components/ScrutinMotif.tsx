import React from "react";
import Svg, { Defs, Pattern, Rect, Path, Circle, Line, G } from "react-native-svg";
import { catUI } from "../categoryUI";

/**
 * Filigrane de fond du Fil : un micro-motif géométrique propre à la CATÉGORIE, tracé
 * monochrome, répété très serré et teinté à la couleur du thème (via `catUI(id).fg` — la
 * source officielle des teintes de catégorie), en opacité basse. De loin : une trame
 * abstraite ; de près seulement, on reconnaît le motif. Technique légère : un `<Pattern>`
 * SVG répété (pas d'image bitmap). Aucune couleur en dur : la teinte vient du token de
 * catégorie ; un motif par défaut couvre les catégories non mappées.
 */

const TILE = 46; // maille serrée

// Chaque motif = tracé MONOCHROME dans une tuile TILE×TILE (couleur injectée = teinte du thème).
const MOTIFS: Record<string, (c: string) => React.ReactNode> = {
  sante: (c) => (
    <G stroke={c} strokeWidth={2} fill="none" strokeLinecap="round">
      <Path d="M4 23h6l3-7 4 14 3-7h6" />
      <Path d="M35 8v8M31 12h8" />
    </G>
  ),
  ecologie: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round">
      <Path d="M12 30c0-9 7-16 16-16-1 9-7 16-16 16z" />
      <Path d="M14 28c4-4 8-7 12-9" />
    </G>
  ),
  economie: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none">
      <Circle cx={14} cy={14} r={7} />
      <Circle cx={32} cy={32} r={7} />
      <Path d="M11 14h6M14 11v6" strokeLinecap="round" />
    </G>
  ),
  travail: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round">
      <Rect x={8} y={16} width={20} height={14} rx={2} />
      <Path d="M14 16v-3h8v3" strokeLinecap="round" />
    </G>
  ),
  education: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <Path d="M6 16l16-7 16 7-16 7-16-7z" />
      <Path d="M30 20v7c0 2-4 4-8 4s-8-2-8-4v-7" />
    </G>
  ),
  immigration: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round">
      <Rect x={12} y={8} width={20} height={28} rx={3} />
      <Circle cx={22} cy={19} r={4} />
      <Path d="M17 30h10" strokeLinecap="round" />
    </G>
  ),
  solidarites: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 32c-8-5-12-9-12-15a5 5 0 0 1 9-2 5 5 0 0 1 9 2c0 6-4 10-6 12" />
    </G>
  ),
  institutions: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round">
      <Path d="M8 16l14-8 14 8" />
      <Line x1={12} y1={18} x2={12} y2={32} />
      <Line x1={22} y1={18} x2={22} y2={32} />
      <Line x1={32} y1={18} x2={32} y2={32} />
      <Line x1={8} y1={34} x2={36} y2={34} />
    </G>
  ),
  agriculture: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round">
      <Path d="M22 34V14" />
      <Path d="M22 20c-3-1-6-4-6-8 4 0 6 3 6 6M22 20c3-1 6-4 6-8-4 0-6 3-6 6" />
      <Path d="M22 28c-3-1-6-3-6-7 4 0 6 3 6 5M22 28c3-1 6-3 6-7-4 0-6 3-6 5" />
    </G>
  ),
  "international-defense": (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <Path d="M23 7l13 5v8c0 8-6 12-13 15-7-3-13-7-13-15v-8l13-5z" />
      <Path d="M23 15l2 4 4 .4-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.4 2-4z" />
    </G>
  ),
  logement: (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <Path d="M8 22l10-9 10 9" />
      <Path d="M11 22v10h14V22" />
      <Path d="M28 24l7-6 4 4" />
    </G>
  ),
  "securite-justice": (c) => (
    <G stroke={c} strokeWidth={1.8} fill="none" strokeLinecap="round">
      <Line x1={23} y1={9} x2={23} y2={33} />
      <Line x1={12} y1={13} x2={34} y2={13} />
      <Path d="M12 13l-4 8h8l-4-8zM34 13l-4 8h8l-4-8z" strokeLinejoin="round" />
      <Line x1={17} y1={34} x2={29} y2={34} />
    </G>
  ),
};

const DEFAULT_MOTIF = (c: string) => (
  <G fill={c} stroke="none">
    <Circle cx={12} cy={12} r={2} />
    <Circle cx={34} cy={12} r={2} />
    <Circle cx={23} cy={23} r={2} />
    <Circle cx={12} cy={34} r={2} />
    <Circle cx={34} cy={34} r={2} />
  </G>
);

let seq = 0;

export function ScrutinMotif({
  categorieId,
  width,
  height,
  opacity = 0.06,
}: {
  categorieId: string | null | undefined;
  width: number;
  height: number;
  opacity?: number;
}) {
  const pid = React.useMemo(() => `motif-${++seq}`, []);
  if (!width || !height) return null;
  const tint = catUI(categorieId ?? "").fg; // teinte officielle du thème (jamais un hex en dur)
  const draw = (categorieId && MOTIFS[categorieId]) || DEFAULT_MOTIF;

  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <Pattern id={pid} patternUnits="userSpaceOnUse" width={TILE} height={TILE}>
          {draw(tint)}
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${pid})`} opacity={opacity} />
    </Svg>
  );
}
