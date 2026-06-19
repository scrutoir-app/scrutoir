import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { getPartis } from "../api";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";

export function PartisScreen({ nav }: { nav: Nav }) {
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPartis().then(setPartis).finally(() => setLoading(false));
  }, []);

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>Partis</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 1, marginBottom: 16 }}>
        Taux de réussite par groupe — leur ligne de vote suit-elle le résultat ?
      </Text>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        <View style={{ gap: 10 }}>
          {partis.map((p) => (
            <TouchableOpacity
              key={p.uid}
              activeOpacity={0.7}
              onPress={() => nav.push({ name: "parti", uid: p.uid })}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}
            >
              <View style={{ width: 10, height: 38, borderRadius: 5, backgroundColor: p.couleur ?? C.textFaint }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{p.abrev ?? p.libelle}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 1 }} numberOfLines={1}>
                  {p.libelle} · {p.nb_deputes} élus
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", marginRight: 4 }}>
                <Text style={{ fontFamily: F.extra, fontSize: 19, color: C.accent, letterSpacing: -0.3 }}>
                  {p.reussite_pct ?? "—"}<Text style={{ fontFamily: F.bold, fontSize: 11, color: C.textFaint }}>%</Text>
                </Text>
                <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.textFaint }}>réussite</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
