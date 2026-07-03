import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F, T, positionLabel, couleurPosition } from "../theme";
import { getVotesDepute } from "../api";
import type { VoteScrutin } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { TypeScrutinFilter } from "../components/TypeScrutinFilter";
import { compterParType, filtrerParType, doitAfficherFiltreType, typeEffectif, type TypeScrutin } from "../typeScrutin";

export function VotesListeScreen({
  uid, nom, categorie, categorieLibelle, position, nav,
}: {
  uid: string;
  nom: string;
  categorie: string;
  categorieLibelle: string;
  position: string;
  nav: Nav;
}) {
  const [scrutins, setScrutins] = useState<VoteScrutin[]>([]);
  const [loading, setLoading] = useState(true);
  const { filtered, Bar } = useScrutinDateFilter(scrutins);
  const [typeScr, setTypeScr] = useState<TypeScrutin>("tous");
  const voteExprime = position === "pour" || position === "contre" || position === "abstention";

  const comptesType = compterParType(filtered);
  const visibles = filtrerParType(filtered, typeEffectif(typeScr, comptesType));

  useEffect(() => {
    getVotesDepute(uid, categorie, position, "all")
      .then(setScrutins)
      .finally(() => setLoading(false));
  }, [uid, categorie, position]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={visibles}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      ListHeaderComponent={
        <View style={{ paddingTop: 12 }}>
          <Text style={[T.heading, { color: C.text }]}>
            {position === "absent" || position === "nonvotant"
              ? `${nom} — n'a pas pris part`
              : `${nom} — a voté « ${positionLabel(position)} »`}
          </Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 10 }]}>
            {visibles.length} scrutins en {categorieLibelle}
          </Text>
          {Bar}
          {doitAfficherFiltreType(comptesType) && (
            <View style={{ marginTop: 6 }}>
              <TypeScrutinFilter value={typeScr} onChange={setTypeScr} counts={comptesType} />
            </View>
          )}
          <View style={{ height: 11 }} />
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun scrutin.
        </Text>
      }
      renderItem={({ item }) => (
        <View>
          <ScrutinCard scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
          {voteExprime && item.consigne != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7, marginLeft: 4 }}>
              <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>
                consigne du groupe :
              </Text>
              <Text style={[T.micro, { fontFamily: F.bold, color: couleurPosition(item.consigne) }]}>
                {positionLabel(item.consigne)}
              </Text>
              {item.consigne !== position && (
                <Text style={[T.micro, { fontFamily: F.bold, color: C.contre }]}>· écart</Text>
              )}
            </View>
          )}
        </View>
      )}
    />
  );
}
