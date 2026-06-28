import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { getPartis } from "../api";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { DuelVedette } from "../components/DuelVedette";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";

export function PartisScreen({ nav }: { nav: Nav }) {
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [loading, setLoading] = useState(true);
  const je = useJe();

  useEffect(() => {
    getPartis().then(setPartis).finally(() => setLoading(false));
  }, []);

  // Principe directeur : avec un « je », on trie par proximité décroissante ; sinon on garde
  // l'ordre par effectifs (partis.json est déjà nb_deputes desc), jamais gauche→droite.
  const ordered = useMemo(() => {
    if (!je) return partis;
    return [...partis].sort((a, b) => {
      const pa = scoreGroupeJe(je, a.abrev)?.pct ?? -1;
      const pb = scoreGroupeJe(je, b.abrev)?.pct ?? -1;
      return pb - pa || b.nb_deputes - a.nb_deputes;
    });
  }, [partis, je]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Partis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          {je
            ? "Triés selon ta proximité."
            : "Les groupes de la 17ᵉ législature — cohésion, participation et positions par thème."}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      {/* Bloc « duel » vivant (déménagé de l'accueil) : aperçu, visages, relancer. */}
      <DuelVedette nav={nav} />
      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        <View style={{ gap: 10 }}>
          {ordered.map((p) => {
            const score = scoreGroupeJe(je, p.abrev);
            return (
              <TouchableOpacity
                key={p.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "parti", uid: p.uid })}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}
              >
                <HemicyclePicto groupes={partis} activeAbrev={p.abrev} color={p.couleur ?? C.textFaint} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{p.abrev ?? p.libelle}</Text>
                  <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={2}>
                    {p.libelle}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", marginRight: 4 }}>
                  {score ? (
                    <>
                      <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.text }]}>{Math.round(score.pct * 100)}<Text style={[T.small, { fontFamily: F.bold, color: C.textFaint }]}>%</Text></Text>
                      <Text style={[T.micro, tnum, { fontFamily: F.medium, color: C.textFaint }]}>proximité · {p.nb_deputes} élus</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[T.heading, tnum, { color: C.text }]}>{p.nb_deputes}</Text>
                      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>élus</Text>
                    </>
                  )}
                </View>
                <Feather name="chevron-right" size={18} color={C.textFaint} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      </ScrollView>
    </View>
  );
}
