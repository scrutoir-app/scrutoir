import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, RADIUS, F, shadowCard } from "../theme";
import { catUI } from "../categoryUI";
import type { CategorieRef } from "../types";

/** Tuile de thème NEUTRE (picto + libellé court). Photo réservée au hero des grands scrutins. */
function Tile({ c, onPress }: { c: CategorieRef; onPress: () => void }) {
  const ui = catUI(c.id);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ width: "23.5%", aspectRatio: 0.82, borderRadius: RADIUS.md, backgroundColor: C.surface, padding: 9, justifyContent: "space-between", ...shadowCard }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={ui.icon as any} size={17} color={ui.fg} />
      </View>
      <Text
        style={{ fontFamily: F.bold, fontSize: 10.5, color: C.text, lineHeight: 12.5, letterSpacing: -0.2 }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {ui.court ?? c.libelle}
      </Text>
    </TouchableOpacity>
  );
}

/** Grille fixe de catégories en pictos neutres (4 colonnes), tout visible sans défiler. */
export function CategoryGrid({ cats, onOpen }: { cats: CategorieRef[]; onOpen: (c: CategorieRef) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9 }}>
      {cats.map((c) => (
        <Tile key={c.id} c={c} onPress={() => onOpen(c)} />
      ))}
    </View>
  );
}
