import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, F, RADIUS, shadowCard } from "../theme";
import { getScrutinsCategorie, getPartisParCategorie } from "../api";
import type { ScrutinResume, PartiReussiteCategorie } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";

export function CategorieScreen({ id, libelle, nav }: { id: string; libelle: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[]>([]);
  const [partis, setPartis] = useState<PartiReussiteCategorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getScrutinsCategorie(id), getPartisParCategorie(id)])
      .then(([s, p]) => { setScrutins(s); setPartis(p); })
      .finally(() => setLoading(false));
  }, [id]);

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
        <View style={{ paddingTop: 14 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 21, color: C.text, letterSpacing: -0.4 }}>{libelle}</Text>

          {/* Partis en tête sur ce thème */}
          {partis.length > 0 && (
            <>
              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.text, marginTop: 16, marginBottom: 3 }}>
                Partis en tête sur ce thème
              </Text>
              <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginBottom: 10, lineHeight: 15 }}>
                Réussite = la ligne du groupe a suivi le résultat (l'emporte le plus souvent).
              </Text>
              <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 4, paddingHorizontal: 13, ...shadowCard }}>
                {partis.map((p, i) => (
                  <TouchableOpacity
                    key={p.uid}
                    activeOpacity={0.6}
                    onPress={() => nav.push({ name: "parti", uid: p.uid })}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}
                  >
                    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.textFaint, width: 18 }}>{i + 1}</Text>
                    <View style={{ width: 8, height: 22, borderRadius: 4, backgroundColor: p.couleur ?? C.textFaint }} />
                    <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.text }}>{p.abrev ?? p.libelle}</Text>
                    <View style={{ width: 70, height: 6, borderRadius: 3, backgroundColor: C.surfaceSunken, overflow: "hidden", marginRight: 8 }}>
                      <View style={{ width: `${p.reussite_pct ?? 0}%`, height: "100%", backgroundColor: C.accent }} />
                    </View>
                    <Text style={{ fontFamily: F.extra, fontSize: 14, color: C.text, width: 38, textAlign: "right" }}>{p.reussite_pct}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.text, marginTop: 22, marginBottom: 2 }}>
            Scrutins ({scrutins.length})
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginBottom: 2, lineHeight: 16 }}>
            Les plus récents d'abord. Classement automatique à partir de l'intitulé.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>Aucun scrutin dans ce thème.</Text>
      }
      renderItem={({ item }) => (
        <ScrutinRow scrutin={item} onPress={() => nav.push({ name: "scrutin", uid: item.uid })} />
      )}
    />
  );
}
