import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F } from "../theme";
import { getScrutinsCategorie } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";

export function CategorieScreen({ id, libelle, nav }: { id: string; libelle: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[]>([]);
  const [loading, setLoading] = useState(true);

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
      data={scrutins}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 14 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text, letterSpacing: -0.4 }}>{libelle}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 4, marginBottom: 4 }}>
            {scrutins.length} scrutins classés dans ce thème (les plus récents d'abord)
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginBottom: 4, lineHeight: 16 }}>
            Classement automatique et approximatif à partir de l'intitulé du scrutin.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun scrutin dans ce thème.
        </Text>
      }
      renderItem={({ item }) => (
        <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
