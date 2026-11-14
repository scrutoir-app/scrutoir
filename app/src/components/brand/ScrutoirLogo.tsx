import React from "react";
import { View } from "react-native";
import { ScrutoirMark } from "./ScrutoirMark";
import { ScrutoirWordmark } from "./ScrutoirWordmark";
import { C, getScheme } from "../../theme";

/**
 * NOUVELLE VERSION (juin 2026). Verrouillage complet picto + logotype.
 * variant "horizontal" (picto à gauche) ou "vertical" (picto au dessus).
 */
export function ScrutoirLogo({
  variant = "horizontal",
  wordHeight = 28,
  color = C.text,
  accent = C.accent,
  whiteSeat = true,
}: {
  variant?: "horizontal" | "vertical";
  wordHeight?: number;
  color?: string;
  accent?: string;
  whiteSeat?: boolean;
}) {
  const vertical = variant === "vertical";
  // Ratio picto / mot. Le picto étant un hémicycle large, on reste proche de la
  // hauteur du mot en horizontal (lockup équilibré) plutôt qu'au double.
  const markSize = wordHeight * (vertical ? 3.0 : 1.45);
  // Contour du siège blanc et du point du i : citron en sombre, couleur du logo en clair.
  const contour = getScheme() === "dark" ? C.marqueContour : color;
  return (
    <View
      style={{
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        gap: wordHeight * (vertical ? 0.5 : 0.45),
      }}
    >
      <ScrutoirMark size={markSize} color={color} accent={accent} whiteSeat={whiteSeat} ring={contour} />
      <ScrutoirWordmark height={wordHeight} color={color} dotStroke={contour} />
    </View>
  );
}
