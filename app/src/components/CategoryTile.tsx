import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { catUI } from "../categoryUI";

/** Tuile de catégorie (grille). Une seule cible tactile : tout le bloc. */
export function CategoryTile({
  id,
  libelle,
  onPress,
  pct,
  pour,
  contre,
  abstention,
}: {
  id: string;
  libelle: string;
  onPress: () => void;
  pct?: number | null;
  pour?: number;
  contre?: number;
  abstention?: number;
}) {
  const ui = catUI(id);
  const avecData = pct != null;
  const tot = (pour ?? 0) + (contre ?? 0) + (abstention ?? 0) || 1;
  const seg = (v: number | undefined, col: string) =>
    v ? <View key={col} style={{ flex: v / tot, backgroundColor: col }} /> : null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
        <View
          style={{
            width: 34, height: 34, borderRadius: 11, backgroundColor: ui.bg,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name={ui.icon as any} size={19} color={ui.fg} />
        </View>
        {avecData && (
          <Text style={{ fontFamily: F.extra, fontSize: 19, color: C.text, letterSpacing: -0.3 }}>
            {pct}
            <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.textFaint }}>%</Text>
          </Text>
        )}
      </View>
      <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text, lineHeight: 17, minHeight: avecData ? 34 : undefined }}>
        {libelle}
      </Text>
      {avecData && (
        <>
          <View style={{ flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: C.surfaceSunken, marginTop: 9 }}>
            {seg(pour, C.pour)}
            {seg(contre, C.contre)}
            {seg(abstention, C.abstention)}
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.textFaint, marginTop: 6 }}>
            {pour ?? 0} pour · {contre ?? 0} contre
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
