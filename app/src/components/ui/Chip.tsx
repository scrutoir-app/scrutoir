import React from "react";
import { View, Text, type ViewStyle, type StyleProp, type TextStyle } from "react-native";
import { C, F, T, RADIUS } from "../../theme";

/**
 * Pastille / badge — petit conteneur arrondi coloré autour d'un libellé court (résultat de
 * scrutin « Adopté/Rejeté », compteurs, tags). Centralise la forme (rayon, paddings, typo) :
 * pour retoucher tous les badges, on modifie ce fichier.
 *
 * Couleurs `bg`/`fg` explicites (l'app encode du SENS dans la couleur) — pas de variante
 * codée en dur ici. Défaut de rayon `pill` ; passez `radius={7}` pour les badges à coins
 * légèrement arrondis. Padding via `ph`/`pv` (valeurs libres, alignées sur l'existant).
 */
export type ChipProps = {
  label: string;
  bg: string;
  fg: string;
  radius?: number;
  ph?: number; // paddingHorizontal
  pv?: number; // paddingVertical
  textStyle?: StyleProp<TextStyle>;
  bold?: boolean;
  icon?: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  bg,
  fg,
  radius = RADIUS.pill,
  ph = 10,
  pv = 3,
  textStyle,
  bold = true,
  icon,
  gap = 4,
  style,
}: ChipProps) {
  const box: ViewStyle = {
    backgroundColor: bg,
    borderRadius: radius,
    paddingHorizontal: ph,
    paddingVertical: pv,
    ...(icon ? { flexDirection: "row", alignItems: "center", gap } : null),
  };
  return (
    <View style={[box, style]}>
      {icon}
      <Text style={[T.micro, bold ? { fontFamily: F.bold } : null, { color: fg }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}
