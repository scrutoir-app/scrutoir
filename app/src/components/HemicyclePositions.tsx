import React, { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";
import { markGeo, coupolePoints, ownersFor, type GroupeGeo } from "./hemicycleGeo";
import { C, couleurPosition } from "../theme";

/**
 * Hémicycle rempli, chaque siège coloré selon la POSITION (pour / contre / abstention) du
 * groupe qui l'occupe. Réutilise EXACTEMENT la géométrie officielle partagée (`coupolePoints`
 * + `ownersFor` + `markGeo`, comme `HemicyclePicto` / `HemicycleCamps`) : aucune géométrie
 * inventée. Les couleurs viennent de `couleurPosition` (tokens de vote), jamais d'un parti.
 */
export function HemicyclePositions({
  groupes,
  positions,
  size = 300,
}: {
  groupes: GroupeGeo[]; // { abrev, nb_deputes } pour la distribution des sièges
  positions: Record<string, "pour" | "contre" | "abstention">; // abrev → position majoritaire
  size?: number;
}) {
  const { w, h, cx, cy, dotR } = markGeo(size);
  const owners = useMemo(() => ownersFor(groupes), [groupes]);
  const points = useMemo(() => coupolePoints(size), [size]);

  return (
    <Svg width={w} height={h}>
      {points.map((d, i) => {
        const ab = owners[i];
        const pos = ab ? positions[ab] : undefined;
        return (
          <Circle key={i} cx={d.x} cy={d.y} r={dotR} fill={pos ? couleurPosition(pos) : C.siege} />
        );
      })}
      {/* Foyer central neutre (identique aux autres hémicycles). */}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill={C.siegeFocal} />
    </Svg>
  );
}
