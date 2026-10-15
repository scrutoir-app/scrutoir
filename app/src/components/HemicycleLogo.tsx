import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { markGeo, coupolePoints, ownersFor, type GroupeGeo } from "./hemicycleGeo";
import { C } from "../theme";

/**
 * Hémicycle du LOGO (18 sièges, géométrie EXACTE de ScrutoirMark via `hemicycleGeo`), coloré
 * siège par siège selon le groupe qui l'occupe (`ownersFor`). Brique commune des hémicycles :
 * l'appelant donne la couleur de chaque groupe (accord avec toi, position de vote, groupe mis
 * en avant…). Un siège sans groupe ou sans couleur reste neutre (`C.siege`) ; foyer central
 * neutre (`C.siegeFocal`) sauf `focal`. Avec `label`, l'hémicycle est annoncé comme une image ;
 * sans, il est décoratif.
 */
export function HemicycleLogo({
  groupes,
  couleur,
  size = 46,
  focal,
  label,
}: {
  groupes: GroupeGeo[];
  couleur: (abrev: string) => string | null | undefined;
  size?: number;
  focal?: string;
  label?: string;
}) {
  const { w, h, cx, cy, dotR } = markGeo(size);
  // Placement mémorisé sur la liste des groupes (cache module) ; points selon la taille seule.
  const owners = useMemo(() => ownersFor(groupes), [groupes]);
  const points = useMemo(() => coupolePoints(size), [size]);

  const svg = (
    <Svg width={w} height={h}>
      {points.map((d, i) => {
        const ab = owners[i];
        return <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={(ab && couleur(ab)) || C.siege} />;
      })}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill={focal ?? C.siegeFocal} />
    </Svg>
  );
  if (!label) return svg;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      {svg}
    </View>
  );
}
