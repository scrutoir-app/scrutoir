import React, { useMemo } from "react";
import Svg, { Circle } from "react-native-svg";
import { markGeo, coupolePoints, ownersFor, type GroupeGeo } from "./hemicycleGeo";
import { C, couleurGroupe } from "../theme";

/**
 * Pictogramme : situe un groupe parlementaire sur un hémicycle miniature, en
 * réutilisant la géométrie EXACTE du `ScrutoirMark` (via `hemicycleGeo`). Les points
 * du groupe `activeAbrev` sont en `color`, les autres en gris neutre. Le placement
 * gauche→droite suit `ORDRE_HEMICYCLE` (priorité à la position sur l'axe, pas au volume)
 * et garantit au moins un siège par groupe ordonné présent.
 */
export function HemicyclePicto({
  groupes,
  activeAbrev,
  color,
  size = 46,
}: {
  groupes: GroupeGeo[];
  activeAbrev: string | null;
  color: string;
  size?: number;
}) {
  const { w, h, cx, cy, dotR } = markGeo(size);

  // Placement : mémorisé sur la liste des groupes (cache module → calculé une seule fois).
  const ownerAbrev = useMemo(() => ownersFor(groupes), [groupes]);
  // Coordonnées des points : ne dépendent que de la taille.
  const points = useMemo(() => coupolePoints(size), [size]);
  // Couleur d'identité éclaircie au besoin pour rester lisible en sombre (RN marine, GDR bordeaux).
  const actif = couleurGroupe(color);

  return (
    <Svg width={w} height={h}>
      {points.map((d, i) => (
        <Circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={dotR}
          fill={ownerAbrev[i] && ownerAbrev[i] === activeAbrev ? actif : C.siege}
        />
      ))}
      {/* Point focal central, neutre (≠ accent du mark) */}
      <Circle cx={cx} cy={cy} r={size * 0.1} fill={C.siegeFocal} />
    </Svg>
  );
}
