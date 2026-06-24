import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard, formatDate } from "../theme";
import { getCategories } from "../api";
import { catUI } from "../categoryUI";
import type { CategorieRef } from "../types";
import type { Nav } from "../nav";

/** Ligne de thème : picto + libellé + contexte (nb de scrutins, dernier) + chevron. */
function ThemeRow({ c, onPress }: { c: CategorieRef; onPress: () => void }) {
  const ui = catUI(c.id);
  const meta: string[] = [];
  if (c.nb_scrutins != null) meta.push(`${c.nb_scrutins} scrutins`);
  if (c.derniere_date) meta.push(`dernier le ${formatDate(c.derniere_date)}`);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, marginBottom: 9, ...shadowCard }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={ui.icon as any} size={22} color={ui.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{c.libelle}</Text>
        {meta.length > 0 && (
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>
            {meta.join(" · ")}
          </Text>
        )}
        {c.dernier_titre && (
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 3 }]} numberOfLines={1}>
            Dernier : {c.dernier_titre}
          </Text>
        )}
      </View>
      <Feather name="chevron-right" size={20} color={C.textFaint} />
    </TouchableOpacity>
  );
}

export function ThemesScreen({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories().then(setCats).finally(() => setLoading(false));
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Thèmes</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Parcourez les scrutins par grand sujet
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
        ) : (
          [...cats].sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0)).map((c) => (
            <ThemeRow key={c.id} c={c} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
