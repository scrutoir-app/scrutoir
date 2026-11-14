// Socle commun des écrans de la rubrique Présidentielle 2027.
import React, { useEffect } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../../theme";
import type { Nav } from "../../nav";
import type { IndexPresidentielle, ProgrammeResume } from "../../presidentielle/types";
import { resoudreProgramme } from "../../presidentielle/logique";
import { lienSur, useIndexPresidentielle } from "../../presidentielle/donnees";
import { Pression } from "../../components/presidentielle/primitives";

/**
 * Programme en service, ou renvoi à l'accueil (rubrique hors service, programme inconnu) : sans
 * message d'erreur, comme pour un lien profond. undefined = index encore en lecture.
 */
export function useProgrammeEnService(id: string, nav: Nav): { index: IndexPresidentielle | null; resume: ProgrammeResume | null | undefined } {
  const index = useIndexPresidentielle();
  const resume = index ? resoudreProgramme(index, id) : undefined;
  useEffect(() => {
    if (index && !resume) nav.reset({ name: "search" });
  }, [index, resume]);
  return { index, resume };
}

/** Renvoi à l'accueil (identifiant inconnu dans un programme en service). */
export function useRenvoiAccueil(condition: boolean, nav: Nav) {
  useEffect(() => {
    if (condition) nav.reset({ name: "search" });
  }, [condition]);
}

export function Chargement() {
  return (
    <View style={{ flex: 1, justifyContent: "center", paddingVertical: 48 }}>
      <ActivityIndicator color={C.textMuted} />
    </View>
  );
}

/** Lien « Comment on compare » (ouvre la feuille de méthode). */
export function LienMethode({ onPress }: { onPress: () => void }) {
  return (
    <Pression
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Comment on compare : la méthode"
      style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Feather name="help-circle" size={16} color={C.accent} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Comment on compare</Text>
    </Pression>
  );
}

/** Lien vers un site externe lu dans les données (https seulement). */
export function LienExterne({ url, libelle }: { url: string | null | undefined; libelle: string }) {
  const sur = lienSur(url);
  if (!sur) return null;
  return (
    <Pression
      accessibilityRole="link"
      accessibilityLabel={`${libelle} (site externe)`}
      onPress={() => Linking.openURL(sur).catch(() => {})}
      style={{ alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Text style={[T.small, { fontFamily: F.bold, color: C.accent, flexShrink: 1 }]}>{libelle}</Text>
      <Feather name="external-link" size={14} color={C.accent} />
    </Pression>
  );
}

export const MARGE = 16;
