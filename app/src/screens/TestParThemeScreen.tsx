import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator } from "react-native";
import { C } from "../theme";
import { getPartis, getCategories, getTestProximite } from "../api";
import { useJe } from "../testProximite/jeProximite";
import { neuvesParTheme } from "../testProximite/config";
import { ParThemeSwipe } from "../components/ParThemeSwipe";
import type { PartiResume, CategorieRef } from "../types";
import type { QuestionProximite } from "../testProximite/score";
import type { Nav } from "../nav";

/**
 * Écran « Par thème » (atteint depuis le bloc explore du résultat) : le carrousel
 * ParThemeSwipe, alimenté par le « je » enregistré localement (aucun param d'URL requis).
 */
export function TestParThemeScreen({ nav }: { nav: Nav }) {
  const je = useJe();
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);

  useEffect(() => {
    Promise.all([getPartis(), getCategories()]).then(([ps, cs]) => { setPartis(ps); setCats(cs); });
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);

  if (!je || !partis.length) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <ParThemeSwipe resultat={je.resultat} partis={partis} cats={cats} nav={nav} neufParTheme={neuvesParTheme(questions, je.reponses)} />
    </ScrollView>
  );
}
