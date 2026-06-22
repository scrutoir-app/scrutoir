import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, positionLabel } from "../theme";
import { getVotants } from "../api";
import type { Votant } from "../types";
import type { Nav } from "../nav";

export function VotantsScreen({
  scrutinUid, titre, position, groupe, groupeLibelle, nav,
}: {
  scrutinUid: string;
  titre: string;
  position: string;
  groupe?: string;
  groupeLibelle?: string;
  nav: Nav;
}) {
  const [votants, setVotants] = useState<Votant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVotants(scrutinUid, position, groupe)
      .then(setVotants)
      .finally(() => setLoading(false));
  }, [scrutinUid, position, groupe]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <FlatList
      data={votants}
      keyExtractor={(v) => v.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 14 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 18, color: C.text, letterSpacing: -0.3 }}>
            Ont voté « {positionLabel(position)} »{groupeLibelle ? ` — ${groupeLibelle}` : ""}
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 3 }} numberOfLines={2}>
            {votants.length} députés · {titre}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun député.
        </Text>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => nav.push({ name: "depute", uid: item.uid })}
          style={{
            flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8,
            borderTopWidth: 0.5, borderTopColor: C.border,
          }}
        >
          <Image
            source={{ uri: item.photo_url ?? undefined }}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.surfaceAlt }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{item.nom_complet}</Text>
            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 1 }}>{item.abrev ?? "—"}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}
    />
  );
}
