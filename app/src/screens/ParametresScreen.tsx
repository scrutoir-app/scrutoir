import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, shadowCard } from "../theme";
import { Card } from "../components/ui";
import { APP_VERSION } from "../config";
import { useThemeMode } from "../themeMode";
import { usePartyLogos } from "../prefs";
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
    <Card>
      <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Apparence</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 2, marginBottom: 12 }]}>
        « Auto » suit le réglage clair/sombre de ton appareil.
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
    </Card>
  );
}

/** Avatars des groupes : sigles lisibles (défaut) ou logos officiels (opt-in). */
function GroupAvatarSelector() {
  const [logosOn, setLogosOn] = usePartyLogos();
  const opts: { v: boolean; label: string }[] = [
    { v: false, label: "Sigles" },
    { v: true, label: "Logos officiels" },
  ];
  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
          <Feather name="users" size={17} color={C.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Avatars des groupes</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>
            Logos officiels des groupes, ou sigles (plus lisibles). S'applique à tes suivis.
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12, marginTop: 12 }}>
        {opts.map((o) => {
          const actif = logosOn === o.v;
          return (
            <TouchableOpacity
              key={String(o.v)}
              onPress={() => setLogosOn(o.v)}
              accessibilityRole="button"
              accessibilityLabel={`Avatars : ${o.label}`}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: 9, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}
            >
              <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Card>
  );
}

export function ParametresScreen(_props: { nav: Nav }) {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <ThemeSelector />
      <GroupAvatarSelector />

      <Text style={[T.small, { color: C.textFaint, marginTop: 14, marginHorizontal: 4 }]}>
        Le détail « À propos & limites » et les mentions légales restent dans l'onglet Infos.
      </Text>

      <View style={{ marginTop: 22, alignItems: "center" }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Scrutoir · version {APP_VERSION}</Text>
        <Text style={[T.small, { fontFamily: F.regular, color: C.textFaint, marginTop: 2, textAlign: "center" }]}>
          Indique ce numéro avec tes retours pour situer la version concernée.
        </Text>
      </View>
    </ScrollView>
  );
}
