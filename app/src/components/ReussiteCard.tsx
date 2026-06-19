import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { catUI } from "../categoryUI";

interface ReussiteData {
  id: string;
  libelle: string;
  gagnes: number;
  perdus: number;
  reussite_pct: number | null;
}

/** Carte "Réussite" d'un thème : le résultat a-t-il suivi le vote (député ou parti) ? */
export function ReussiteCard({ cat, onPress }: { cat: ReussiteData; onPress: () => void }) {
  const ui = catUI(cat.id);
  const base = cat.gagnes + cat.perdus;
  const pct = cat.reussite_pct;
  // Couleur de la pastille selon le niveau (neutre : ardoise haut, gris bas).
  const fg = pct == null ? C.textFaint : pct >= 50 ? C.accent : C.textMuted;

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 11 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={17} color={ui.fg} />
        </View>
        <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text }}>{cat.libelle}</Text>
        <Text style={{ fontFamily: F.extra, fontSize: 19, color: fg, letterSpacing: -0.3 }}>
          {pct == null ? "—" : `${pct}`}
          {pct != null && <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.textFaint }}>%</Text>}
        </Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </View>
      <View style={{ flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
        {base > 0 && <View style={{ flex: cat.gagnes / base, backgroundColor: C.accent }} />}
        {base > 0 && <View style={{ flex: cat.perdus / base, backgroundColor: C.surfaceSunken }} />}
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 6 }}>
        {cat.gagnes} fois dans la majorité · {cat.perdus} fois dans la minorité
      </Text>
    </TouchableOpacity>
  );
}
