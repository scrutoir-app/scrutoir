import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F, positionLabel, couleurPosition } from "../theme";
import { getVotesDepute } from "../api";
import type { VoteScrutin } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

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
  const voteExprime = position === "pour" || position === "contre" || position === "abstention";

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
      data={filtered}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text }}>
            {position === "absent" || position === "nonvotant"
              ? `${nom} — n'a pas pris part`
              : `${nom} — a voté « ${positionLabel(position)} »`}
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 3, marginBottom: 10 }}>
            {filtered.length} scrutins en {categorieLibelle}
          </Text>
          {Bar}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun scrutin.
        </Text>
      }
      renderItem={({ item }) => (
        <View>
          <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
          {voteExprime && item.consigne != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4, marginBottom: 8, marginLeft: 4 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint }}>
                consigne du groupe :
              </Text>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: couleurPosition(item.consigne) }}>
                {positionLabel(item.consigne)}
              </Text>
              {item.consigne !== position && (
                <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.contre }}>· écart</Text>
              )}
            </View>
          )}
        </View>
      )}
    />
  );
}
