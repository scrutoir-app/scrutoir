import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, F, formatDate, positionLabel } from "../theme";
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
          <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text, letterSpacing: -0.4 }}>Dissidences</Text>
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.textMuted, marginTop: 2 }}>{nom}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 6, marginBottom: 4, lineHeight: 17 }}>
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
          <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text, lineHeight: 19 }} numberOfLines={2}>
            {item.titre || item.objet}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <Pastille texte={`A voté : ${positionLabel(item.position)}`} fg={C.loyalBas} bg={C.loyalBasBg} />
            <Pastille texte={`Consigne : ${positionLabel(item.consigne)}`} fg={C.textMuted} bg={C.surfaceAlt} />
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint }}>{formatDate(item.date)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

function Pastille({ texte, fg, bg }: { texte: string; fg: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
      <Text style={{ fontFamily: F.semibold, color: fg, fontSize: 11 }}>{texte}</Text>
    </View>
  );
}
