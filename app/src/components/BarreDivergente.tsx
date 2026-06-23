import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F } from "../theme";

/**
 * Barre divergente à axe central PARTAGÉ entre les lignes d'une même liste
 * (positions par thème). Échelle RELATIVE aux exprimés du thème : la longueur
 * « Pour » (part du centre vers la gauche) et « Contre » (vers la droite) est
 * proportionnelle à pour/(pour+contre). Colonne de libellé à largeur fixe pour
 * que l'axe central tombe au même endroit sur toute la liste.
 */
const LABEL_W = 96;

export function BarreDivergente({
  label,
  pour,
  contre,
  abstention,
  onPress,
}: {
  label?: string;
  pour: number;
  contre: number;
  abstention?: number;
  onPress?: () => void;
}) {
  const base = pour + contre || 1;
  const pPour = (pour / base) * 100;
  const pContre = (contre / base) * 100;
  const piste = C.hairline;
  const axe = C.hairlineStrong;

  const contenu = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: label != null ? 48 : 0 }}>
      {label != null && (
        <Text
          style={{ width: LABEL_W, fontFamily: F.semibold, fontSize: 12.5, color: C.text }}
          numberOfLines={2}
        >
          {label}
        </Text>
      )}

      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", height: 11 }}>
        <View style={{ flex: 1, height: 11, backgroundColor: piste, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, flexDirection: "row", justifyContent: "flex-end", overflow: "hidden" }}>
          <View style={{ width: `${pPour}%`, height: "100%", backgroundColor: C.pour }} />
        </View>
        <View style={{ width: 1.5, height: 13, backgroundColor: axe }} />
        <View style={{ flex: 1, height: 11, backgroundColor: piste, borderTopRightRadius: 3, borderBottomRightRadius: 3, flexDirection: "row", justifyContent: "flex-start", overflow: "hidden" }}>
          <View style={{ width: `${pContre}%`, height: "100%", backgroundColor: C.contre }} />
        </View>
      </View>

      {onPress && <Feather name="chevron-right" size={16} color={C.textFaint} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
        {contenu}
      </TouchableOpacity>
    );
  }
  return contenu;
}
