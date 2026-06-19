import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F, positionLabel } from "../theme";
import { getVotesDepute } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";

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
  const [scrutins, setScrutins] = useState<ScrutinResume[]>([]);
  const [loading, setLoading] = useState(true);

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
      data={scrutins}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text }}>
            {position === "absent" || position === "nonvotant"
              ? `${nom} — n'a pas pris part`
              : `${nom} — a voté « ${positionLabel(position)} »`}
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 3, marginBottom: 4 }}>
            {scrutins.length} scrutins en {categorieLibelle}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun scrutin.
        </Text>
      }
      renderItem={({ item }) => (
        <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
