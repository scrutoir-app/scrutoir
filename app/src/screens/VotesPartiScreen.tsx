import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, F, positionLabel } from "../theme";
import { getVotesParti } from "../api";
import type { VoteScrutin, Periode } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

/** Scrutins où le groupe a tenu une position donnée sur un thème (drill-down fiche parti). */
export function VotesPartiScreen({
  uid, libelle, categorie, categorieLibelle, position, periode, nav,
}: {
  uid: string;
  libelle: string;
  categorie: string;
  categorieLibelle: string;
  position: string;
  periode: Periode;
  nav: Nav;
}) {
  const [scrutins, setScrutins] = useState<VoteScrutin[]>([]);
  const [loading, setLoading] = useState(true);
  const { filtered, Bar } = useScrutinDateFilter(scrutins);

  useEffect(() => {
    getVotesParti(uid, categorie, position, periode)
      .then(setScrutins)
      .finally(() => setLoading(false));
  }, [uid, categorie, position, periode]);

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
            {libelle} — consigne « {positionLabel(position)} »
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 3, marginBottom: 10 }}>
            {filtered.length} scrutins en {categorieLibelle}
          </Text>
          {Bar}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>Aucun scrutin.</Text>
      }
      renderItem={({ item }) => (
        <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
