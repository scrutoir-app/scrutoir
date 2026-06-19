import React from "react";
import { View, Text, TouchableOpacity, ImageBackground } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, F, shadowCard } from "../theme";
import { catUI, catPhoto } from "../categoryUI";
import type { CategorieRef } from "../types";

const ABS = { position: "absolute" as const, left: 0, right: 0, top: 0, bottom: 0 };

/** Tuile photo compacte (grille fixe, libellé court). */
function Tile({ c, onPress }: { c: CategorieRef; onPress: () => void }) {
  const ui = catUI(c.id);
  const photo = catPhoto(c.id, c.id);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width: "23.5%", aspectRatio: 0.82, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: ui.bg, ...shadowCard }}
    >
      <ImageBackground source={photo ? { uri: photo } : undefined} style={{ flex: 1 }} resizeMode="cover">
        <View style={{ ...ABS, backgroundColor: "rgba(16,20,28,0.42)" }} />
        <View style={{ flex: 1, padding: 7, justifyContent: "space-between" }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={ui.icon as any} size={15} color="#fff" />
          </View>
          <Text
            style={{
              fontFamily: F.bold, fontSize: 10.5, color: "#fff", lineHeight: 12.5, letterSpacing: -0.2,
              textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {ui.court ?? c.libelle}
          </Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

/** Grille fixe de catégories en tuiles photo (4 colonnes), tout visible sans défiler. */
export function CategoryGrid({ cats, onOpen }: { cats: CategorieRef[]; onOpen: (c: CategorieRef) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 9 }}>
      {cats.map((c) => (
        <Tile key={c.id} c={c} onPress={() => onOpen(c)} />
      ))}
    </View>
  );
}
