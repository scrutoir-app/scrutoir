import React from "react";
import { View, TouchableOpacity, type ViewStyle, type StyleProp } from "react-native";
import { C, RADIUS, shadowCard, S } from "../../theme";

/**
 * Carte de surface — la brique visuelle la plus répandue de l'app (fond `surface`, coins
 * arrondis, ombre portée). Elle POSSÈDE la combinaison de tokens : pour retoucher le style
 * de TOUTES les cartes (rayon, ombre, padding, filet), on modifie ce fichier, pas les écrans.
 *
 * Défauts = pattern historique exact (`surface` + RADIUS.md + padding 14 + shadowCard) → un
 * remplacement `<View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>`
 * par `<Card>` ne déplace aucun pixel.
 *
 * - `onPress` → rend un TouchableOpacity (rôle bouton) au lieu d'une View.
 * - `bordered` → ajoute le filet `C.border` (certaines cartes le cumulent avec l'ombre).
 * - `raised={false}` → carte plate (sans ombre), pour les tuiles internes.
 */
export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: number;
  radius?: number;
  bordered?: boolean;
  raised?: boolean;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link" | "none";
  accessibilityState?: { selected?: boolean; disabled?: boolean; expanded?: boolean };
  disabled?: boolean;
};

export function Card({
  children,
  onPress,
  padding = S.s14,
  radius = RADIUS.md,
  bordered = false,
  raised = true,
  activeOpacity = 0.7,
  style,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  disabled,
}: CardProps) {
  const base: ViewStyle = {
    backgroundColor: C.surface,
    borderRadius: radius,
    padding,
    ...(bordered ? { borderWidth: 1, borderColor: C.border } : null),
    ...(raised ? shadowCard : null),
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        style={[base, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      style={[base, style]}
    >
      {children}
    </View>
  );
}
