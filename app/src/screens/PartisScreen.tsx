import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
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
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Partis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Les groupes de la 17ᵉ législature — cohésion, participation et positions par thème.
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
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
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{p.abrev ?? p.libelle}</Text>
                <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={1}>
                  {p.libelle} · {p.nb_deputes} élus
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", marginRight: 4 }}>
                <Text style={[T.heading, tnum, { color: C.text }]}>{p.nb_deputes}</Text>
                <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>élus</Text>
              </View>
              <Feather name="chevron-right" size={18} color={C.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}
