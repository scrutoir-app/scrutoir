import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { C } from "../theme";
import { getPartis, getCategories } from "../api";
import { useJe } from "../testProximite/jeProximite";
import { ParThemeSwipe } from "../components/ParThemeSwipe";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";

/**
 * Écran « Par thème » (atteint depuis le bloc explore du résultat) : le carrousel
 * ParThemeSwipe, alimenté par le « je » enregistré localement (aucun param d'URL requis).
 */
export function TestParThemeScreen({ nav: _nav }: { nav: Nav }) {
  const je = useJe();
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);

  useEffect(() => {
    Promise.all([getPartis(), getCategories()]).then(([ps, cs]) => { setPartis(ps); setCats(cs); });
  }, []);

  if (!je || !partis.length) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <ParThemeSwipe resultat={je.resultat} partis={partis} cats={cats} />
    </ScrollView>
  );
}
