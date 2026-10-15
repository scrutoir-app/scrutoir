import React from "react";
import { HemicycleLogo } from "./HemicycleLogo";
import type { GroupeGeo } from "./hemicycleGeo";
import { couleurGroupe } from "../theme";

/**
 * Pictogramme : situe un groupe parlementaire sur un hémicycle miniature, en
 * réutilisant la géométrie EXACTE du `ScrutoirMark` (via `HemicycleLogo`). Les points
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
  // Couleur d'identité éclaircie au besoin pour rester lisible en sombre (RN marine, GDR bordeaux).
  const actif = couleurGroupe(color);
  return <HemicycleLogo groupes={groupes} size={size} couleur={(ab) => (ab === activeAbrev ? actif : null)} />;
}
