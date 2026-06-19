import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { C, F } from "../theme";
import { getCategories } from "../api";
import type { CategorieRef } from "../types";
import type { Nav } from "../nav";
import { CategoryTile } from "../components/CategoryTile";

export function ThemesScreen({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then(setCats).finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>Thèmes</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 1, marginBottom: 16 }}>
        Parcourez les scrutins par grand sujet
      </Text>
      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 11 }}>
          {cats.map((c) => (
            <View key={c.id} style={{ width: "48.5%" }}>
              <CategoryTile id={c.id} libelle={c.libelle} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
