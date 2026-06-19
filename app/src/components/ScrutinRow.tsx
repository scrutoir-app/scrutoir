import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { C, F, formatDate } from "../theme";
import type { ScrutinResume } from "../types";

/** Ligne de scrutin pour les listes (séparateur, pas de carte). */
export function ScrutinRow({
  scrutin,
  onPress,
}: {
  scrutin: ScrutinResume;
  onPress: () => void;
}) {
  const adopte = scrutin.sort_code === "adopte";
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{ paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.border }}
    >
      <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text, lineHeight: 19 }} numberOfLines={2}>
        {scrutin.titre || scrutin.objet}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: adopte ? C.adopteBg : C.rejeteBg }}>
          <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: adopte ? C.adopteFg : C.rejeteFg }}>
            {adopte ? "Adopté" : "Rejeté"}
          </Text>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint }}>{formatDate(scrutin.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}
