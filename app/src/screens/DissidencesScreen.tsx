import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, F, T, formatDate, positionLabel } from "../theme";
import { Chip } from "../components/ui";
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
        <View style={{ paddingTop: 14 }}>
          <Text style={[T.title, { color: C.text }]}>Dissidences</Text>
          <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: 2 }]}>{nom}</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 6, marginBottom: 4 }]}>
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
          <Text style={[T.body, { fontFamily: F.semibold, color: C.text }]} numberOfLines={2}>
            {item.titre || item.objet}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <Chip label={`A voté : ${positionLabel(item.position)}`} fg={C.loyalBas} bg={C.loyalBasBg} radius={8} ph={8} bold={false} />
            <Chip label={`Consigne : ${positionLabel(item.consigne)}`} fg={C.textMuted} bg={C.surfaceAlt} radius={8} ph={8} bold={false} />
            <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>{formatDate(item.date)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
