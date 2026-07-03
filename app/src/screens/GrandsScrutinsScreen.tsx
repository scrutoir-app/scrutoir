import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, T } from "../theme";
import { getGrandsScrutins } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";

export function GrandsScrutinsScreen({ nav }: { nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");

  useEffect(() => {
    getGrandsScrutins().then(setScrutins);
  }, []);

  const comptesType = compterParType(filtered);
  const visibles = filtrerParType(filtered, typeEffectif(typeScr, comptesType));

  if (!scrutins)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={visibles}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      ListHeaderComponent={
        <View style={{ paddingBottom: 14 }}>
          <Text style={[T.title, { color: C.text }]}>Grands scrutins</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1, marginBottom: 12 }]}>
            Scrutins solennels et motions de censure ({visibles.length})
          </Text>
          {Bar}
          {doitAfficherFiltreType(comptesType) && (
            <View style={{ marginTop: 6 }}>
              <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <ScrutinCard scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
