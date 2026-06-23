import React from "react";
import { View, Text, FlatList } from "react-native";
import { C, F, T } from "../theme";
import type { ConfrontationScrutin } from "../types";
import type { Nav } from "../nav";
import { ScrutinLigne } from "./ConfrontationScreen";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

/**
 * Liste dédiée des scrutins d'accord (ou de désaccord) entre deux élus, sur un
 * thème. Page séparée pour accueillir les filtres année/mois (denses).
 */
export function ConfrontationListeScreen({
  kind,
  themeLibelle,
  sousTitre,
  scrutins,
  nav,
}: {
  kind: "accord" | "desaccord";
  themeLibelle: string;
  sousTitre: string;
  scrutins: ConfrontationScrutin[];
  nav: Nav;
}) {
  const { filtered, Bar } = useScrutinDateFilter(scrutins);
  const couleur = kind === "accord" ? C.pour : C.contre;
  const motPluriel = kind === "accord" ? "accord" : "désaccord";

  return (
    <FlatList
      data={filtered}
      keyExtractor={(s) => s.uid}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ paddingTop: 14, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleur }} />
            <Text style={[T.heading, { fontFamily: F.extra, color: C.text }]}>
              {kind === "accord" ? "Accords" : "Désaccords"} · {themeLibelle}
            </Text>
          </View>
          <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 12 }]}>
            {sousTitre} · {filtered.length} {motPluriel}
            {filtered.length > 1 ? "s" : ""}
          </Text>
          {Bar}
        </View>
      }
      ListEmptyComponent={
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun {motPluriel} sur cette période.
        </Text>
      }
      renderItem={({ item }) => <ScrutinLigne sc={item} nav={nav} />}
    />
  );
}
