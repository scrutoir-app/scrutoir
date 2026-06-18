import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { C, formatDate } from "../theme";
import type { ScrutinResume } from "../types";

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
      onPress={onPress}
      style={{ paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: C.border }}
    >
      <Text style={{ fontSize: 14, color: C.text }} numberOfLines={2}>
        {scrutin.titre || scrutin.objet}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <View
          style={{
            paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8,
            backgroundColor: adopte ? C.loyalHautBg : C.loyalBasBg,
          }}
        >
          <Text style={{ fontSize: 10, color: adopte ? C.loyalHaut : C.loyalBas }}>
            {adopte ? "Adopté" : "Rejeté"}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: C.textFaint }}>{formatDate(scrutin.date)}</Text>
      </View>
    </TouchableOpacity>
  );
}
