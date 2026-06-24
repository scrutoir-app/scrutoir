import React from "react";
import { View, Text, FlatList } from "react-native";
import { C, F, T, tnum, RADIUS } from "../theme";
import type { ConfrontationScrutin, DeputeResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinLigne } from "./ConfrontationScreen";
import { DuelDeputesBar } from "../components/DuelDeputesBar";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";

/**
 * Liste dédiée des scrutins d'accord (ou de désaccord) entre deux élus, sur un
 * thème. Page séparée pour accueillir les filtres année/mois (denses). La barre
 * sticky des deux élus (avec le thème + le taux) garde le contexte au scroll.
 */
export function ConfrontationListeScreen({
  kind,
  themeLibelle,
  sousTitre,
  scrutins,
  depA,
  depB,
  communs,
  nav,
}: {
  kind: "accord" | "desaccord";
  themeLibelle: string;
  sousTitre: string;
  scrutins: ConfrontationScrutin[];
  depA: DeputeResume;
  depB: DeputeResume;
  communs: number;
  nav: Nav;
}) {
  const { filtered, Bar } = useScrutinDateFilter(scrutins);
  const couleur = kind === "accord" ? C.pour : C.contre;
  const motPluriel = kind === "accord" ? "accord" : "désaccord";
  // Taux de ce versant (accords OU désaccords) sur l'ensemble des scrutins communs
  // du thème — repère stable, indépendant du filtre date appliqué à la liste.
  const tauxKind = communs ? Math.round((scrutins.length / communs) * 100) : null;

  return (
    <View style={{ flex: 1 }}>
      {/* Barre sticky : les deux élus + thème consulté + taux de ce versant. */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <DuelDeputesBar
          a={depA}
          b={depB}
          center={
            <View style={{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, alignItems: "center", maxWidth: 148 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleur }} />
                <Text numberOfLines={1} style={[T.micro, { fontFamily: F.bold, color: C.text, maxWidth: 116 }]}>{themeLibelle}</Text>
              </View>
              {tauxKind != null && (
                <Text style={[T.micro, tnum, { fontFamily: F.semibold, color: C.textMuted, marginTop: 1 }]}>
                  {tauxKind}% {kind === "accord" ? "d'accord" : "de désac."}
                </Text>
              )}
            </View>
          }
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.uid}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 54, paddingBottom: 40 }}
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
    </View>
  );
}
