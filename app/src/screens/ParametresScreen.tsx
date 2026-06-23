import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { APP_VERSION } from "../config";
import { useThemeMode } from "../themeMode";
import type { SchemePref } from "../theme";
import type { Nav } from "../nav";

/** Sélecteur de thème : Clair / Sombre / Auto (suit le système). */
function ThemeSelector() {
  const { pref, setPref } = useThemeMode();
  const opts: { v: SchemePref; label: string; icon: any }[] = [
    { v: "light", label: "Clair", icon: "sun" },
    { v: "dark", label: "Sombre", icon: "moon" },
    { v: "auto", label: "Auto", icon: "smartphone" },
  ];
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
      <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Apparence</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 2, marginBottom: 12 }]}>
        « Auto » suit le réglage clair/sombre de votre appareil.
      </Text>
      <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12 }}>
        {opts.map((o) => {
          const actif = pref === o.v;
          return (
            <TouchableOpacity
              key={o.v}
              onPress={() => setPref(o.v)}
              accessibilityRole="button"
              accessibilityLabel={`Thème ${o.label}`}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}
            >
              <Feather name={o.icon} size={15} color={actif ? C.text : C.textMuted} />
              <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function ParametresScreen(_props: { nav: Nav }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <ThemeSelector />

      <Text style={[T.small, { color: C.textFaint, marginTop: 14, marginHorizontal: 4 }]}>
        Le détail « À propos & limites » et les mentions légales restent dans l'onglet Infos.
      </Text>

      <View style={{ marginTop: 22, alignItems: "center" }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Scrutoir · version {APP_VERSION}</Text>
        <Text style={[T.small, { fontFamily: F.regular, color: C.textFaint, marginTop: 2, textAlign: "center" }]}>
          Indiquez ce numéro avec vos retours pour situer la version concernée.
        </Text>
      </View>
    </ScrollView>
  );
}
