import React from "react";
import { Text, TouchableOpacity, ActivityIndicator, type ViewStyle, type StyleProp, type TextStyle } from "react-native";
import { C, F, T, RADIUS, shadowCard, S } from "../../theme";

/**
 * Bouton — primitive UNIFIÉE (décision produit : cohérence > reproduction fidèle des
 * anciens boutons, qui mélangeaient rayon pill/md et paddings 13→16). Toutes les CTA
 * passent désormais par ce composant : forme (rayon pill), rythme (paddings par taille),
 * couleur (`onAccent` adaptatif clair/sombre) sont définis ICI, une seule fois.
 *
 * Variantes :
 * - `primary` : aplat `accent` + texte `onAccent` + ombre (CTA principale).
 * - `outline` : filet `accent`, fond transparent (action secondaire).
 * - `soft`    : aplat `accentSoft` + texte `accent` (action tertiaire discrète).
 * - `text`    : sans fond ni filet (lien d'action) — `muted` pour l'atténuer.
 */
export type ButtonVariant = "primary" | "outline" | "soft" | "text";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  muted?: boolean; // variante "text" : couleur atténuée (textMuted) au lieu d'accent
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

const PAD: Record<ButtonSize, { pv: number; ph: number; text: TextStyle }> = {
  sm: { pv: S.s8, ph: S.s12, text: T.small },
  md: { pv: S.s14, ph: S.s20, text: T.body },
  lg: { pv: S.s16, ph: S.s24, text: T.body },
};

/**
 * Force la couleur de l'icône (Feather / MaterialCommunityIcons) à suivre le premier plan
 * du bouton (`fg`) : en primary, l'icône devient `onAccent` comme le libellé — donc encre
 * foncée en sombre, pas blanche. Les `color=…` passés au site d'appel sont ainsi neutralisés
 * (cohérence garantie par la primitive). Sans effet sur les variantes où `fg` = C.accent.
 */
function tintIcon(node: React.ReactNode, fg: string): React.ReactNode {
  return React.isValidElement(node)
    ? React.cloneElement(node as React.ReactElement<{ color?: string }>, { color: fg })
    : node;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  muted,
  disabled,
  loading,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const p = PAD[size];

  // Couleur de premier plan (texte + spinner) selon la variante.
  const fg =
    variant === "primary" ? C.onAccent : muted && variant === "text" ? C.textMuted : C.accent;

  const box: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: S.s8,
    borderRadius: RADIUS.pill,
    paddingVertical: variant === "text" ? S.s8 : p.pv,
    paddingHorizontal: variant === "text" ? S.s8 : p.ph,
    ...(fullWidth ? { alignSelf: "stretch" } : null),
    ...(variant === "primary" ? { backgroundColor: C.accent, ...shadowCard } : null),
    ...(variant === "soft" ? { backgroundColor: C.accentSoft } : null),
    ...(variant === "outline" ? { borderWidth: 1, borderColor: C.accent } : null),
    ...(disabled ? { opacity: 0.5 } : null),
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={[box, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {tintIcon(iconLeft, fg)}
          <Text style={[p.text, { fontFamily: F.bold, color: fg }, textStyle]}>{label}</Text>
          {tintIcon(iconRight, fg)}
        </>
      )}
    </TouchableOpacity>
  );
}
