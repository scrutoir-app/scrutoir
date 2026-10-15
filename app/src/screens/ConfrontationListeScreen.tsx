import React from "react";
import { View, Text, FlatList } from "react-native";
import { C, F, T, tnum, RADIUS, S } from "../theme";
import type { ConfrontationScrutin, DeputeResume } from "../types";
import type { Nav } from "../nav";
import { LigneVoteDuel, EnteteColonnes } from "./ConfrontationScreen";
import { DuelDeputesBar } from "../components/DuelDeputesBar";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { Card } from "../components/ui";

/**
 * Détail d'un Face à face : les scrutins pareils ou opposés d'un thème, ou tous les votes en commun.
 * Même ligne que les « Derniers votes » (ce qui a été voté, positions en deux colonnes), avec les
 * filtres résultat / année / mois. La barre des deux élus (thème + part de ce versant) garde le
 * contexte au scroll.
 */
const x = (n: number) => (n > 1 ? "s" : "");
const LIBELLES = {
  accord: { titre: "Votes pareils", compte: (n: number) => `${n} vote${x(n)} pareil${x(n)}`, centre: "pareils" },
  desaccord: { titre: "Votes opposés", compte: (n: number) => `${n} vote${x(n)} opposé${x(n)}`, centre: "opposés" },
  tous: { titre: "Votes en commun", compte: (n: number) => `${n} vote${x(n)} en commun`, centre: "d'accord" },
} as const;

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
  kind: "accord" | "desaccord" | "tous";
  themeLibelle: string;
  sousTitre: string;
  scrutins: ConfrontationScrutin[];
  depA: DeputeResume;
  depB: DeputeResume;
  communs: number;
  nav: Nav;
}) {
  const { filtered, Bar } = useScrutinDateFilter(scrutins);
  const L = LIBELLES[kind];
  const couleur = kind === "accord" ? C.pour : kind === "desaccord" ? C.contre : C.accent;
  // Part de ce versant sur tous les votes communs du thème (repère stable, hors filtre de date) ;
  // pour « tous », la part de votes pareils.
  const n = kind === "tous" ? scrutins.filter((s) => s.posA === s.posB).length : scrutins.length;
  const taux = communs ? Math.round((n / communs) * 100) : null;
  const titre = kind === "tous" ? L.titre : `${L.titre} · ${themeLibelle}`;
  const compte = L.compte(filtered.length);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
        <DuelDeputesBar
          a={depA}
          b={depB}
          center={
            <View style={{ paddingVertical: 4, paddingHorizontal: S.s10, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, alignItems: "center", maxWidth: 148 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleur }} />
                <Text numberOfLines={1} style={[T.micro, { fontFamily: F.bold, color: C.text, maxWidth: 116 }]}>{themeLibelle}</Text>
              </View>
              {taux != null && <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 1 }]}>{taux} % {L.centre}</Text>}
            </View>
          }
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(s) => s.uid}
        contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: 54, paddingBottom: S.s40 }}
        ListHeaderComponent={
          <View style={{ paddingTop: S.s14, marginBottom: S.s8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleur }} />
              <Text accessibilityRole="header" style={[T.heading, { flex: 1, color: C.text }]}>{titre}</Text>
            </View>
            <Text style={[T.small, tnum, { color: C.textMuted, marginTop: 3, marginBottom: S.s12 }]}>{sousTitre} · {compte}</Text>
            {Bar}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: S.s14, marginTop: S.s12 }}>
              <EnteteColonnes a={depA} b={depB} />
            </View>
          </View>
        }
        ListEmptyComponent={<Text style={[T.body, { textAlign: "center", color: C.textMuted, marginTop: S.s32 }]}>Aucun vote sur cette période.</Text>}
        renderItem={({ item, index }) => (
          <Card padding={0} raised={false} radius={0} style={{ backgroundColor: C.surface, ...(index === 0 ? { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg } : null), ...(index === filtered.length - 1 ? { borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg } : null) }}>
            <LigneVoteDuel sc={item} premier={index === 0} depA={depA} depB={depB} nav={nav} />
          </Card>
        )}
      />
    </View>
  );
}
