import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, StatusBar, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { C, F, shadowCard } from "./src/theme";
import type { Route, Nav } from "./src/nav";
import { SearchScreen } from "./src/screens/SearchScreen";
import { ThemesScreen } from "./src/screens/ThemesScreen";
import { GrandsScrutinsScreen } from "./src/screens/GrandsScrutinsScreen";
import { PartisScreen } from "./src/screens/PartisScreen";
import { PartiScreen } from "./src/screens/PartiScreen";
import { DeputeScreen } from "./src/screens/DeputeScreen";
import { ScrutinScreen } from "./src/screens/ScrutinScreen";
import { CategorieScreen } from "./src/screens/CategorieScreen";
import { DissidencesScreen } from "./src/screens/DissidencesScreen";
import { AProposScreen } from "./src/screens/AProposScreen";
import { VotesListeScreen } from "./src/screens/VotesListeScreen";
import { VotesCategorieScreen } from "./src/screens/VotesCategorieScreen";
import { VotantsScreen } from "./src/screens/VotantsScreen";
import { ConfrontationScreen } from "./src/screens/ConfrontationScreen";
import { MonDeputeScreen } from "./src/screens/MonDeputeScreen";
import { SuivisScreen } from "./src/screens/SuivisScreen";

const TABS: { root: Route["name"]; label: string; icon: any }[] = [
  { root: "search", label: "Accueil", icon: "home" },
  { root: "themes", label: "Thèmes", icon: "grid" },
  { root: "partis", label: "Partis", icon: "users" },
  { root: "suivis", label: "Suivis", icon: "bell" },
  { root: "apropos", label: "Infos", icon: "info" },
];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  const [stack, setStack] = useState<Route[]>([{ name: "search" }]);
  const current = stack[stack.length - 1];
  const root = stack[0].name;

  const nav: Nav = {
    push: useCallback((route: Route) => setStack((s) => [...s, route]), []),
    pop: useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []),
  };
  const goTab = (name: Route["name"]) => setStack([{ name } as Route]);

  const titres: Record<Route["name"], string> = {
    search: "", themes: "", apropos: "", partis: "", suivis: "",
    grandsScrutins: "Grands scrutins", parti: "Parti",
    depute: "Député·e", scrutin: "Scrutin", categorie: "Thème",
    dissidences: "Dissidences", votesCategorie: "Votes par thème",
    votesDepute: "Détail des votes", votants: "Votants",
    confrontation: "Confrontation",
    monDepute: "Mon·ma député·e",
  };
  const showHeader = stack.length > 1;

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
          maxWidth: 480, width: "100%", flex: 1, alignSelf: "center",
          ...(Platform.OS === "web" ? { borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: C.border } : {}),
        }}
      >
        {showHeader && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", height: 50,
              borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 8, backgroundColor: C.surface,
            }}
          >
            <TouchableOpacity onPress={nav.pop} style={{ padding: 8, flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 24, color: C.accent, marginTop: -2 }}>‹</Text>
              <Text style={{ fontSize: 15, color: C.accent, marginLeft: 2, fontFamily: F.semibold }}>Retour</Text>
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 16, fontFamily: F.bold, color: C.text, marginRight: 64 }}>
              {titres[current.name]}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {current.name === "search" && <SearchScreen nav={nav} />}
          {current.name === "themes" && <ThemesScreen nav={nav} />}
          {current.name === "grandsScrutins" && <GrandsScrutinsScreen nav={nav} />}
          {current.name === "partis" && <PartisScreen nav={nav} />}
          {current.name === "parti" && <PartiScreen uid={current.uid} nav={nav} />}
          {current.name === "depute" && <DeputeScreen uid={current.uid} nav={nav} />}
          {current.name === "scrutin" && <ScrutinScreen uid={current.uid} nav={nav} />}
          {current.name === "categorie" && <CategorieScreen id={current.id} libelle={current.libelle} nav={nav} />}
          {current.name === "dissidences" && <DissidencesScreen uid={current.uid} nom={current.nom} nav={nav} />}
          {current.name === "votesCategorie" && (
            <VotesCategorieScreen uid={current.uid} nom={current.nom} categorie={current.categorie} categorieLibelle={current.categorieLibelle} periode={current.periode} nav={nav} />
          )}
          {current.name === "votesDepute" && (
            <VotesListeScreen uid={current.uid} nom={current.nom} categorie={current.categorie} categorieLibelle={current.categorieLibelle} position={current.position} nav={nav} />
          )}
          {current.name === "votants" && (
            <VotantsScreen scrutinUid={current.scrutinUid} titre={current.titre} position={current.position} groupe={current.groupe} groupeLibelle={current.groupeLibelle} nav={nav} />
          )}
          {current.name === "apropos" && <AProposScreen />}
          {current.name === "confrontation" && <ConfrontationScreen a={current.a} b={current.b} nav={nav} />}
          {current.name === "monDepute" && <MonDeputeScreen nav={nav} />}
          {current.name === "suivis" && <SuivisScreen nav={nav} />}
        </View>

        {/* Barre d'onglets */}
        <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface, paddingTop: 8, paddingBottom: 10 }}>
          {TABS.map((t) => {
            const actif = root === t.root;
            return (
              <TouchableOpacity key={t.root} onPress={() => goTab(t.root)} style={{ flex: 1, alignItems: "center", gap: 3 }}>
                <Feather name={t.icon} size={21} color={actif ? C.text : C.textFaint} />
                <Text style={{ fontFamily: actif ? F.bold : F.medium, fontSize: 10.5, color: actif ? C.text : C.textFaint }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
