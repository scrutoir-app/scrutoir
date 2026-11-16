import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON } from "../theme";
import { type Verdict, verdictLabel, verdictPhrase } from "../testProximite/verdict";
import { useReduceMotion } from "./HeroScrutins";
import { usePressScale } from "../hooks/usePressScale";

/**
 * Pastille de VERDICT « comme toi » — quatre états visuellement distincts :
 *  · VOTÉ      → fond PLEIN + coche (tu as tranché ce scrutin, au test ou depuis le scrutin)
 *  · SANS AVIS → fond plein neutre + tiret (tu as dit « sans avis » : aucune déduction)
 *  · DÉDUIT    → contour POINTILLÉS + picto profil (calculé de ton profil, pas un vote posé)
 *  · VERROUILLÉ → cadenas (pas encore situé)
 * La COULEUR encode le SENS (vert = dans ton sens · rouge = à l'opposé · neutre = partagé),
 * jamais un parti. Voté, sans avis et déduit portent un crayon : un tap ouvre le tiroir de vote
 * (corriger sur place). Verrouillé : l'appelant décide (légende, onboarding ou test).
 * Au changement d'état (déduit → voté), fondu croisé de 220 ms entre l'ancienne et la nouvelle
 * pastille (le style de bordure ne s'anime pas) ; coupé si animations réduites.
 */

const natif = Platform.OS !== "web";

function couleurs(v: Verdict): { fg: string; bg: string } {
  if (v.niveau === "verrouille") return { fg: C.textMuted, bg: C.surfaceAlt };
  if (v.niveau === "sans_avis") return { fg: C.accent, bg: C.surfaceAlt };
  if (v.sens === "align") return { fg: C.pour, bg: C.adopteBg };
  if (v.sens === "oppose") return { fg: C.contre, bg: C.rejeteBg };
  return { fg: C.textMuted, bg: C.surfaceAlt };
}

function icone(v: Verdict): React.ComponentProps<typeof Feather>["name"] {
  if (v.niveau === "verrouille") return "lock";
  if (v.niveau === "vote") return "check";
  if (v.niveau === "sans_avis") return "minus";
  return "user"; // déduit
}

const cle = (v: Verdict) => `${v.niveau}:${v.sens}`;

/** Le rendu d'une pastille (sans zone tactile) : sert à la pastille affichée et au fondu croisé. */
function Corps({ verdict, row, invite, crayon }: { verdict: Verdict; row: boolean; invite: boolean; crayon: boolean }) {
  const { fg, bg } = couleurs(verdict);
  const deduit = verdict.niveau === "deduit";
  const label = verdictLabel(verdict) + (invite && verdict.niveau === "verrouille" ? " Situe-toi pour le savoir" : "");
  const box: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: S.s8,
    alignSelf: "flex-start",
    borderRadius: row ? RADIUS.md : RADIUS.pill,
    paddingVertical: row ? S.s12 : 9,
    paddingHorizontal: row ? S.s14 : S.s12,
    minHeight: 44,
    // Niveau DÉDUIT : contour pointillés + fond transparent (moins « affirmé »). Sinon fond plein.
    backgroundColor: deduit ? "transparent" : bg,
    borderWidth: 1.5,
    borderStyle: deduit ? "dashed" : "solid",
    borderColor: deduit ? fg : bg,
  };
  return (
    <View style={box}>
      <Feather name={icone(verdict)} size={ICON.md} color={fg} />
      <View style={{ flexShrink: 1 }}>
        <Text style={[row ? T.callout : T.small, { fontFamily: F.extra, color: fg }]}>{label}</Text>
        {row && verdict.niveau !== "verrouille" && (
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>{verdictPhrase(verdict)}</Text>
        )}
      </View>
      {crayon && <Feather name="edit-2" size={ICON.sm} color={fg} />}
    </View>
  );
}

export function VerdictPastille({
  verdict,
  onPress,
  mode = "pill",
  style,
  invite = false,
}: {
  verdict: Verdict;
  onPress?: () => void;
  mode?: "pill" | "row"; // pill = Fil/Liste ; row = fiche détail (phrase complète)
  style?: StyleProp<ViewStyle>;
  /** Verrouillé : ajoute l'invitation « Situe-toi pour le savoir » au libellé (fiche scrutin). */
  invite?: boolean;
}) {
  const reduce = useReduceMotion();
  const press = usePressScale();
  const row = mode === "row";
  const corrigeable = !!onPress && verdict.niveau !== "verrouille";
  const label = verdictLabel(verdict) + (invite && verdict.niveau === "verrouille" ? " Situe-toi pour le savoir" : "");
  const a11y =
    verdict.niveau === "verrouille"
      ? "Comme toi ? Situe-toi (ouvrir l'explication)"
      : verdict.niveau === "deduit"
        ? `${label}, déduit de ton profil. Corriger`
        : `${label}, ta réponse. Modifier`;

  // Fondu croisé : l'ancienne pastille s'efface par-dessus la nouvelle (220 ms).
  const [ancien, setAncien] = useState<Verdict | null>(null);
  const fondu = useRef(new Animated.Value(1)).current;
  const precedent = useRef(verdict);
  useEffect(() => {
    const avant = precedent.current;
    precedent.current = verdict;
    if (cle(avant) === cle(verdict) || reduce) return;
    setAncien(avant);
    fondu.setValue(0);
    Animated.timing(fondu, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: natif }).start(({ finished }) => {
      if (finished) setAncien(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle(verdict), reduce]);

  const contenu = (
    <View style={{ alignSelf: "flex-start" }}>
      <Animated.View style={{ opacity: ancien ? fondu : 1 }}>
        <Corps verdict={verdict} row={row} invite={invite} crayon={corrigeable} />
      </Animated.View>
      {ancien && (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={{ position: "absolute", left: 0, top: 0, opacity: fondu.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}
        >
          <Corps verdict={ancien} row={row} invite={invite} crayon={corrigeable} />
        </Animated.View>
      )}
    </View>
  );

  if (!onPress) return <View style={[{ alignSelf: "flex-start" }, style]}>{contenu}</View>;
  return (
    <Animated.View style={[{ alignSelf: "flex-start" }, press.style, style]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={a11y}
      >
        {contenu}
      </TouchableOpacity>
    </Animated.View>
  );
}
