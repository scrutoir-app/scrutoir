import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate } from "../theme";
import { catUI } from "../categoryUI";
import type { ScrutinResume } from "../types";

/** Carte de scrutin façon "fil d'actu" : badge résultat, titre, répartition. */
export function ScrutinCard({ scrutin, onPress }: { scrutin: ScrutinResume; onPress: () => void }) {
  const adopte = scrutin.sort_code === "adopte";
  const p = scrutin.pour ?? 0;
  const c = scrutin.contre ?? 0;
  const a = scrutin.abstention ?? 0;
  const tot = p + c + a;
  const seg = (v: number, col: string) =>
    v ? <View key={col} style={{ flex: v / (tot || 1), backgroundColor: col }} /> : null;
  const ui = scrutin.categorie ? catUI(scrutin.categorie) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {ui && (
            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={ui.icon as any} size={15} color={ui.fg} />
            </View>
          )}
          <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: adopte ? C.adopteBg : C.rejeteBg }}>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: adopte ? C.adopteFg : C.rejeteFg }}>
              {adopte ? "Adopté" : "Rejeté"}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textFaint }}>{formatDate(scrutin.date)}</Text>
      </View>

      <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text, lineHeight: 19 }} numberOfLines={3}>
        {scrutin.titre || scrutin.objet}
      </Text>

      {tot > 0 && (
        <>
          <View style={{ flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken, marginTop: 11 }}>
            {seg(p, C.pour)}
            {seg(c, C.contre)}
            {seg(a, C.abstention)}
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted, marginTop: 7 }}>
            {p} pour · {c} contre · {a} abst.
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
