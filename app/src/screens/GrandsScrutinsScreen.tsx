import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F } from "../theme";
import { getGrandsScrutins } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";

export function GrandsScrutinsScreen({ nav }: { nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);

  useEffect(() => {
    getGrandsScrutins().then(setScrutins);
  }, []);

  if (!scrutins)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={scrutins}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      ListHeaderComponent={
        <View style={{ paddingBottom: 14 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 22, color: C.text, letterSpacing: -0.5 }}>Grands scrutins</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 1 }}>
            Scrutins solennels et motions de censure ({scrutins.length})
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <ScrutinCard scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
