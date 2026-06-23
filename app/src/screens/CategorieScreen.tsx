import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { getScrutinsCategorie } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

export function CategorieScreen({ id, libelle, nav }: { id: string; libelle: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[]>([]);
  const [loading, setLoading] = useState(true);
  const { filtered, Bar } = useScrutinDateFilter(scrutins);

  useEffect(() => {
    getScrutinsCategorie(id)
      .then(setScrutins)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 14 }}>
          <Text style={[T.title, { color: C.text }]}>{libelle}</Text>

          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginTop: 18, marginBottom: 2 }]}>
            Scrutins ({filtered.length})
          </Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginBottom: 10 }]}>
            Les plus récents d'abord. Classement automatique à partir de l'intitulé.
          </Text>
          {Bar}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>Aucun scrutin dans ce thème.</Text>
      }
      renderItem={({ item }) => (
        <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
