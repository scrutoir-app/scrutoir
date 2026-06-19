import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Platform, ActivityIndicator } from "react-native";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { C, F } from "./src/theme";
import type { Route, Nav } from "./src/nav";
import { SearchScreen } from "./src/screens/SearchScreen";
import { DeputeScreen } from "./src/screens/DeputeScreen";
import { ScrutinScreen } from "./src/screens/ScrutinScreen";
import { CategorieScreen } from "./src/screens/CategorieScreen";
import { DissidencesScreen } from "./src/screens/DissidencesScreen";
import { AProposScreen } from "./src/screens/AProposScreen";
import { VotesListeScreen } from "./src/screens/VotesListeScreen";
import { VotesCategorieScreen } from "./src/screens/VotesCategorieScreen";
import { VotantsScreen } from "./src/screens/VotantsScreen";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [stack, setStack] = useState<Route[]>([{ name: "search" }]);
  const current = stack[stack.length - 1];

  const nav: Nav = {
    push: useCallback((route: Route) => setStack((s) => [...s, route]), []),
    pop: useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []),
  };

  const titres: Record<Route["name"], string> = {
    search: "",
    depute: "Député·e",
    scrutin: "Scrutin",
    categorie: "Thème",
    dissidences: "Dissidences",
    votesCategorie: "Votes par thème",
    votesDepute: "Détail des votes",
    votants: "Votants",
    apropos: "À propos",
  };
  const titre = titres[current.name];

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          maxWidth: 480,
          width: "100%",
          flex: 1,
          alignSelf: "center",
          ...(Platform.OS === "web"
            ? { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.border }
            : {}),
        }}
      >
        {current.name !== "search" && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", height: 50,
              borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 8,
              backgroundColor: C.surface,
            }}
          >
            <TouchableOpacity onPress={nav.pop} style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 24, color: C.accent, marginTop: -2 }}>‹</Text>
              <Text style={{ fontSize: 15, color: C.accent, marginLeft: 2, fontFamily: F.semibold }}>Retour</Text>
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: F.bold, color: C.text, marginRight: 64 }}>
              {titre}
            </Text>
          </View>
        )}

        {current.name === "search" && <SearchScreen nav={nav} />}
        {current.name === "depute" && <DeputeScreen uid={current.uid} nav={nav} />}
        {current.name === "scrutin" && <ScrutinScreen uid={current.uid} nav={nav} />}
        {current.name === "categorie" && (
          <CategorieScreen id={current.id} libelle={current.libelle} nav={nav} />
        )}
        {current.name === "dissidences" && (
          <DissidencesScreen uid={current.uid} nom={current.nom} nav={nav} />
        )}
        {current.name === "votesCategorie" && (
          <VotesCategorieScreen
            uid={current.uid}
            nom={current.nom}
            categorie={current.categorie}
            categorieLibelle={current.categorieLibelle}
            periode={current.periode}
            nav={nav}
          />
        )}
        {current.name === "votesDepute" && (
          <VotesListeScreen
            uid={current.uid}
            nom={current.nom}
            categorie={current.categorie}
            categorieLibelle={current.categorieLibelle}
            position={current.position}
            nav={nav}
          />
        )}
        {current.name === "votants" && (
          <VotantsScreen
            scrutinUid={current.scrutinUid}
            titre={current.titre}
            position={current.position}
            groupe={current.groupe}
            groupeLibelle={current.groupeLibelle}
            nav={nav}
          />
        )}
        {current.name === "apropos" && <AProposScreen />}
      </View>
    </SafeAreaView>
  );
}
