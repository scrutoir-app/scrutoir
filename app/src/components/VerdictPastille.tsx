import React from "react";
import { View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON } from "../theme";
import { type Verdict, verdictLabel, verdictPhrase } from "../testProximite/verdict";

/**
 * Pastille de VERDICT « comme toi » — deux niveaux visuellement distincts :
 *  · VOTÉ    → fond PLEIN + coche (tu as réellement tranché ce scrutin au test)
 *  · DÉDUIT  → contour POINTILLÉS + picto profil (calculé de ton profil, pas un vote posé)
 *  · VERROUILLÉ → cadenas (pas encore situé)
 * La COULEUR encode le SENS (vert = dans ton sens · rouge = à l'opposé · neutre = partagé),
 * jamais un parti. Un tap ouvre la légende (rattrapable partout) — ou l'onboarding si verrouillé.
 */

function couleurs(v: Verdict): { fg: string; bg: string } {
  if (v.niveau === "verrouille") return { fg: C.textMuted, bg: C.surfaceAlt };
  if (v.sens === "align") return { fg: C.pour, bg: C.adopteBg };
  if (v.sens === "oppose") return { fg: C.contre, bg: C.rejeteBg };
  return { fg: C.textMuted, bg: C.surfaceAlt };
}

function icone(v: Verdict): React.ComponentProps<typeof Feather>["name"] {
  if (v.niveau === "verrouille") return "lock";
  if (v.niveau === "vote") return "check";
  return "user"; // déduit
}

export function VerdictPastille({
  verdict,
  onPress,
  mode = "pill",
  style,
}: {
  verdict: Verdict;
  onPress?: () => void;
  mode?: "pill" | "row"; // pill = Fil/Liste ; row = fiche détail (phrase complète)
  style?: StyleProp<ViewStyle>;
}) {
  const { fg, bg } = couleurs(verdict);
  const deduit = verdict.niveau === "deduit";
  const label = verdictLabel(verdict);
  const a11y =
    verdict.niveau === "verrouille"
      ? "Comme toi ? Situe-toi (ouvrir l'explication)"
      : `${label}. Ouvrir la légende du verdict`;

  const row = mode === "row";
  const box: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: S.s8,
    alignSelf: "flex-start",
    borderRadius: row ? RADIUS.md : RADIUS.pill,
    paddingVertical: row ? S.s12 : 9,
    paddingHorizontal: row ? S.s14 : S.s12,
    minHeight: 44,
    // Niveau DÉDUIT : contour pointillés + fond quasi transparent (moins « affirmé »).
    // Niveau VOTÉ / verrouillé : fond plein.
    backgroundColor: deduit ? "transparent" : bg,
    ...(deduit ? { borderWidth: 1.5, borderStyle: "dashed", borderColor: fg } : null),
  };

  const contenu = (
    <>
      <Feather name={icone(verdict)} size={ICON.md} color={fg} />
      <View style={{ flexShrink: 1 }}>
        <Text style={[row ? T.callout : T.small, { fontFamily: F.extra, color: fg }]}>{label}</Text>
        {row && verdict.niveau !== "verrouille" && (
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>{verdictPhrase(verdict)}</Text>
        )}
      </View>
    </>
  );

  if (!onPress) return <View style={[box, style]}>{contenu}</View>;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={[box, style]}
    >
      {contenu}
    </TouchableOpacity>
  );
}
