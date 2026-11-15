import React from "react";
import { ScrollView } from "react-native";
import { S } from "../theme";
import { MethodeQuestions } from "../components/MethodeQuestions";

/** « Comment on choisit les questions du test », ouvert depuis l'intro du test (même texte que l'onglet Infos). */
export function MethodeTestScreen() {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: S.s20, paddingTop: S.s14, paddingBottom: S.s32 }} showsVerticalScrollIndicator={false}>
      <MethodeQuestions variante="page" />
    </ScrollView>
  );
}
