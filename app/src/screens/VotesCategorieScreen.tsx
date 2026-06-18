import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { C, positionLabel } from "../theme";
import { getVotesDeputeCategorie } from "../api";
import type { VoteScrutin, Periode } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";

const ORDRE: { pos: string; color: string }[] = [
  { pos: "pour", color: C.pour },
  { pos: "contre", color: C.contre },
  { pos: "abstention", color: C.abstention },
  { pos: "nonvotant", color: C.absent },
];

type Item =
  | { kind: "section"; pos: string; color: string; count: number }
  | { kind: "scrutin"; data: VoteScrutin };

export function VotesCategorieScreen({
  uid, nom, categorie, categorieLibelle, periode, nav,
}: {
  uid: string;
  nom: string;
  categorie: string;
  categorieLibelle: string;
  periode: Periode;
  nav: Nav;
}) {
  const [votes, setVotes] = useState<VoteScrutin[] | null>(null);

  useEffect(() => {
    getVotesDeputeCategorie(uid, categorie, periode).then(setVotes);
  }, [uid, categorie, periode]);

  if (!votes)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  // Groupe par position, dans l'ordre Pour / Contre / Abstention / Absent.
  const items: Item[] = [];
  for (const { pos, color } of ORDRE) {
    const sous = votes.filter((v) => v.position === pos);
    if (sous.length === 0) continue;
    items.push({ kind: "section", pos, color, count: sous.length });
    for (const v of sous) items.push({ kind: "scrutin", data: v });
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it, i) => (it.kind === "section" ? `s-${it.pos}` : `v-${it.data.uid}-${i}`)}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: "500", color: C.text }}>{categorieLibelle}</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 2, marginBottom: 2 }}>
            {nom} · {votes.length} scrutins
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun scrutin dans ce thème pour cette période.
        </Text>
      }
      renderItem={({ item }) =>
        item.kind === "section" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color }} />
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>
              {positionLabel(item.pos)}
            </Text>
            <Text style={{ fontSize: 13, color: C.textMuted }}>· {item.count}</Text>
          </View>
        ) : (
          <ScrutinRow scrutin={item.data} onPress={() => nav.push({ name: "scrutin", uid: item.data.uid })} />
        )
      }
    />
  );
}
