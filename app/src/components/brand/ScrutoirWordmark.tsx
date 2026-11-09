import React from "react";
import Svg, { Path, Circle, G } from "react-native-svg";
import { C, getScheme } from "../../theme";
import { LOGOTYPE } from "./geometrie";

/**
 * Logotype Scrutoir (mot seul), tracé vectoriel Manrope ExtraBold.
 * Le point du i est redessiné en blanc contour encre, jumeau du siège
 * blanc du picto (voir ScrutoirMark). Indépendant du chargement de la police.
 */
export function ScrutoirWordmark({
  height = 28,
  color = C.text,
  dotFill,
  dotStroke = C.text,
}: {
  height?: number;
  color?: string;
  dotFill?: string;
  dotStroke?: string;
}) {
  const { VB_W, VB_H } = LOGOTYPE;
  const width = (height * VB_W) / VB_H;
  // Contour du point aligne sur le picto (meme epaisseur relative)
  const dotStrokeW = LOGOTYPE.point.strokeW;
  // Intérieur du point du i : VIDÉ en sombre (= couleur de fond → on voit le fond à travers),
  // blanc en clair (comportement d'origine). Jumeau du siège blanc du picto (cf. ScrutoirMark).
  const fillPoint = dotFill ?? (getScheme() === "dark" ? C.bg : "#FFFFFF");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <G transform={`translate(${LOGOTYPE.tx} ${LOGOTYPE.ty}) scale(${LOGOTYPE.s} ${-LOGOTYPE.s})`}>
        <Path d={LOGOTYPE.d} fill={color} />
      </G>
      <Circle cx={LOGOTYPE.point.cx} cy={LOGOTYPE.point.cy} r={LOGOTYPE.point.r} fill={fillPoint} stroke={dotStroke} strokeWidth={dotStrokeW} />
    </Svg>
  );
}
