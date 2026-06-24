import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { getScrutinsCategorie, getTestProximite } from "../api";
import type { ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { compterParTheme, themeTestActif, MSG_THEME_VERROUILLE } from "../testProximite/config";

export function CategorieScreen({ id, libelle, nav }: { id: string; libelle: string; nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [testActif, setTestActif] = useState(false);
  const { filtered, Bar } = useScrutinDateFilter(scrutins);

  useEffect(() => {
    getScrutinsCategorie(id)
      .then(setScrutins)
      .finally(() => setLoading(false));
  }, [id]);

  // Accès au test mono-thème : actif seulement si assez de questions validées sur ce thème.
  useEffect(() => {
    getTestProximite()
      .then((qs) => setTestActif(themeTestActif(compterParTheme(qs), id)))
      .catch(() => setTestActif(false));
  }, [id]);

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
        <View style={{ paddingTop: 14 }}>
          <Text style={[T.title, { color: C.text }]}>{libelle}</Text>

          {testActif ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => nav.push({ name: "testIntro", theme: id, themeLibelle: libelle })}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: C.border, ...shadowCard }}
            >
              <Feather name="help-circle" size={18} color={C.accent} />
              <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={1}>Teste ta proximité sur {libelle}</Text>
              <Feather name="chevron-right" size={18} color={C.textFaint} />
            </TouchableOpacity>
          ) : (
            <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 11, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: C.border, opacity: 0.6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name="lock" size={16} color={C.textFaint} />
                <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.textMuted }]} numberOfLines={1}>Teste ta proximité sur {libelle}</Text>
              </View>
              <Text style={[T.micro, { color: C.textFaint, marginTop: 6 }]}>{MSG_THEME_VERROUILLE}</Text>
            </View>
          )}

          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginTop: 18, marginBottom: 2 }]}>
            Scrutins ({filtered.length})
          </Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginBottom: 10 }]}>
            Les plus récents d'abord. Classement automatique à partir de l'intitulé.
          </Text>
          {Bar}
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
