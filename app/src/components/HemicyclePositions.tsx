import React from "react";
import { HemicycleLogo } from "./HemicycleLogo";
import type { GroupeGeo } from "./hemicycleGeo";
import { couleurPosition } from "../theme";

/**
 * Hémicycle rempli, chaque siège coloré selon la POSITION (pour / contre / abstention) du
 * groupe qui l'occupe. Réutilise EXACTEMENT la géométrie officielle partagée (`HemicycleLogo`,
 * comme `HemicyclePicto`) : aucune géométrie inventée. Les couleurs viennent de
 * `couleurPosition` (tokens de vote), jamais d'un parti.
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
  return (
    <HemicycleLogo
      groupes={groupes}
      size={size}
      couleur={(ab) => (positions[ab] ? couleurPosition(positions[ab]) : null)}
    />
  );
}
