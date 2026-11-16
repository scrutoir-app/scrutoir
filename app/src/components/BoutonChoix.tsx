import React from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS } from "../theme";
import { usePressScale } from "../hooks/usePressScale";

/**
 * Bouton de réponse Contre / Sans avis / Pour : le MÊME au test, dans le deck et dans le tiroir
 * de vote (même ordre, même taille). Trois états :
 *  · neutre  : contour gris (le test) ;
 *  · déduit  : contour pointillé à sa couleur + étiquette « déduit » sur le bord haut (le camp
 *    qu'on te prête, dans le tiroir) ;
 *  · choisi  : bordure pleine de 2 px à sa couleur + fond teinté (ta réponse), annoncé « sélectionné ».
 */
export function BoutonChoix({
  icon,
  label,
  couleur,
  teinte,
  etat = "neutre",
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  couleur: string;
  /** Fond quand le bouton est la réponse posée (adopteBg / rejeteBg / accentSoft). */
  teinte?: string;
  etat?: "neutre" | "deduit" | "choisi";
  onPress: () => void;
}) {
  const press = usePressScale();
  const choisi = etat === "choisi";
  const deduit = etat === "deduit";
  const a11y = label + (deduit ? ", déduit de ton profil" : "") + (choisi ? ", ta réponse" : "");
  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        accessibilityState={{ selected: choisi }}
        aria-selected={choisi}
        style={{
          minHeight: 60,
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          backgroundColor: choisi && teinte ? teinte : C.surface,
          borderRadius: RADIUS.md,
          borderWidth: choisi ? 2 : 1.5,
          borderStyle: deduit ? "dashed" : "solid",
          borderColor: choisi || deduit ? couleur : C.borderStrong,
        }}
      >
        <Feather name={icon} size={22} color={couleur} />
        <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{label}</Text>
      </TouchableOpacity>
      {deduit && (
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={{ position: "absolute", top: -9, left: 0, right: 0, alignItems: "center" }}
        >
          <View style={{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: RADIUS.pill, backgroundColor: C.surface, borderWidth: 1, borderStyle: "dashed", borderColor: couleur }}>
            <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>déduit</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}
