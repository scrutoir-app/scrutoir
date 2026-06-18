import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, formatDate, positionLabel } from "../theme";
import { getDissidences } from "../api";
import type { Dissidence } from "../types";
import type { Nav } from "../nav";

export function DissidencesScreen({ uid, nom, nav }: { uid: string; nom: string; nav: Nav }) {
  const [liste, setListe] = useState<Dissidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDissidences(uid)
      .then(setListe)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={liste}
      keyExtractor={(d) => d.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "500", color: C.text }}>Dissidences</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{nom}</Text>
          <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6, marginBottom: 4, lineHeight: 17 }}>
            {liste.length} scrutins où le vote diffère de la consigne majoritaire du groupe
            (les plus récents d'abord).
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucune dissidence : vote toujours conforme à la consigne du groupe.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => nav.push({ name: "scrutin", uid: item.uid })}
          style={{ paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: C.border }}
        >
          <Text style={{ fontSize: 14, color: C.text }} numberOfLines={2}>
            {item.titre || item.objet}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
            <Pastille texte={`A voté : ${positionLabel(item.position)}`} fg={C.loyalBas} bg={C.loyalBasBg} />
            <Pastille texte={`Consigne : ${positionLabel(item.consigne)}`} fg={C.textMuted} bg={C.surfaceAlt} />
            <Text style={{ fontSize: 11, color: C.textFaint }}>{formatDate(item.date)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function Pastille({ texte, fg, bg }: { texte: string; fg: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ color: fg, fontSize: 11 }}>{texte}</Text>
    </View>
  );
}
