import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, formatDate } from "../theme";
import { catUI } from "../categoryUI";
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
  const ui = scrutin.categorie ? catUI(scrutin.categorie) : null;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{ flexDirection: "row", gap: 11, paddingVertical: 13, borderTopWidth: 1, borderTopColor: C.border }}
    >
      {ui && (
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
          <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text, lineHeight: 20 }} numberOfLines={2}>
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
      </View>
    </TouchableOpacity>
  );
}
