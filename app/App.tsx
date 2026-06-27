import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, SafeAreaView, StatusBar, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { C, F, inputText, RADIUS, shadowCard } from "./src/theme";
import type { Route, Nav } from "./src/nav";
import { SearchScreen } from "./src/screens/SearchScreen";
import { SearchResultsList } from "./src/components/SearchResultsList";
import { ThemesScreen } from "./src/screens/ThemesScreen";
import { GrandsScrutinsScreen } from "./src/screens/GrandsScrutinsScreen";
import { PartisScreen } from "./src/screens/PartisScreen";
import { PartiScreen } from "./src/screens/PartiScreen";
import { MembresPartiScreen } from "./src/screens/MembresPartiScreen";
import { VotesPartiScreen } from "./src/screens/VotesPartiScreen";
import { DeputeScreen } from "./src/screens/DeputeScreen";
import { ScrutinScreen } from "./src/screens/ScrutinScreen";
import { CategorieScreen } from "./src/screens/CategorieScreen";
import { DissidencesScreen } from "./src/screens/DissidencesScreen";
import { AProposScreen } from "./src/screens/AProposScreen";
import { VotesListeScreen } from "./src/screens/VotesListeScreen";
import { VotesCategorieScreen } from "./src/screens/VotesCategorieScreen";
import { VotantsScreen } from "./src/screens/VotantsScreen";
import { ConfrontationScreen } from "./src/screens/ConfrontationScreen";
import { ConfrontationListeScreen } from "./src/screens/ConfrontationListeScreen";
import { MonDeputeScreen } from "./src/screens/MonDeputeScreen";
import { ParametresScreen } from "./src/screens/ParametresScreen";
import { SuivisScreen } from "./src/screens/SuivisScreen";
import { MentionsScreen } from "./src/screens/MentionsScreen";
import { TestIntroScreen } from "./src/screens/TestIntroScreen";
import { TestScreen } from "./src/screens/TestScreen";
import { TestResultatScreen } from "./src/screens/TestResultatScreen";
import { lireHashPartage } from "./src/testProximite/storage";
import { InstallPrompt } from "./src/components/InstallPrompt";
import { ParcoursLoi } from "./src/components/ParcoursLoi";
import { useInterstitielParcours } from "./src/parcoursLoiPrefs";
import { useKeyboardOpen } from "./src/useKeyboardOpen";
import { ThemeProvider, useThemeMode } from "./src/themeMode";
import { track } from "./src/analytics";

const TABS: { root: Route["name"]; label: string; icon: any }[] = [
  { root: "search", label: "Accueil", icon: "home" },
  // Onglet de consultation des scrutins (Récents + Par thème). Clé de route historique
  // « themes » conservée (invisible à l'utilisateur) pour éviter toute régression de nav.
  { root: "themes", label: "Scrutins", icon: "grid" },
  { root: "partis", label: "Partis", icon: "users" },
  { root: "suivis", label: "Suivis", icon: "bell" },
  { root: "apropos", label: "Infos", icon: "info" },
];

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}

function AppInner() {
  const { effective } = useThemeMode();
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  const [stack, setStack] = useState<Route[]>([{ name: "search" }]);
  const current = stack[stack.length - 1];

  // Lien de partage du test de proximité (#test=…) : on recalcule à l'ouverture,
  // 100 % client (rien n'est envoyé au serveur). Une seule fois, au montage.
  useEffect(() => {
    const partage = lireHashPartage();
    if (partage && Object.keys(partage.reponses).length) {
      setStack([{ name: "search" }, { name: "testResultat", reponses: partage.reponses, poids: partage.poids }]);
    }
  }, []);

  const root = stack[0].name;
  const keyboardOpen = useKeyboardOpen(); // masque la barre d'onglets quand le clavier est ouvert
  // Recherche EN LIGNE depuis les onglets de navigation (Accueil a déjà sa propre recherche).
  const [gq, setGq] = useState("");
  const ongletAvecRecherche = ["themes", "partis", "suivis", "apropos"].includes(root);
  const enRechercheGlobale = stack.length === 1 && ongletAvecRecherche && gq.trim().length >= 2;
  useEffect(() => { setGq(""); }, [root]); // réinitialise la recherche en changeant d'onglet

  // Interstitiel pédagogique « parcours d'une loi » : montré UNE fois par installation
  // (re-proposé si le contenu change), rejetable. Persistance locale (cf. parcoursLoiPrefs).
  const [interstitiel, setInterstitiel] = useState(useInterstitielParcours());

  const nav: Nav = {
    push: useCallback((route: Route) => setStack((s) => [...s, route]), []),
    pop: useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []),
    replace: useCallback((route: Route) => setStack((s) => [...s.slice(0, -1), route]), []),
  };
  const goTab = (name: Route["name"]) => setStack([{ name } as Route]);

  // Analytics anonyme : un événement par écran/entité consulté (les duels sont tracés
  // dans ConfrontationScreen). Ne casse jamais l'app (track() est protégé).
  useEffect(() => {
    const c = current;
    if (c.name === "depute") track("depute", c.uid);
    else if (c.name === "scrutin") track("scrutin", c.uid);
    else if (c.name === "parti") track("parti", c.uid);
    else if (c.name === "categorie") track("theme", c.id);
    else track("screen", c.name);
  }, [current]);

  // Analytics : installation de la PWA (ajout à l'écran d'accueil).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onInstalled = () => track("install");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  // Masque le splash de chargement (hémicycle qui se remplit) dès que l'app est prête.
  useEffect(() => {
    if ((fontsLoaded || fontError) && typeof window !== "undefined") {
      (window as any).__scrutoirReady?.();
    }
  }, [fontsLoaded, fontError]);

  const titres: Record<Route["name"], string> = {
    search: "", themes: "", apropos: "", partis: "", suivis: "",
    grandsScrutins: "Grands scrutins", parti: "Parti", membresParti: "Élus du groupe", votesParti: "Votes du groupe",
    depute: "Député", scrutin: "Scrutin", categorie: "Thème",
    dissidences: "Dissidences", votesCategorie: "Votes par thème",
    votesDepute: "Détail des votes", votants: "Votants",
    confrontation: "Confrontation",
    confrontationListe: "Confrontation",
    monDepute: "Mon député",
    mentions: "Mentions légales",
    parametres: "Paramètres",
    testIntro: "Test de proximité",
    test: "Test de proximité",
    testResultat: "Ton résultat",
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
    <SafeAreaView key={effective} style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={effective === "dark" ? "light-content" : "dark-content"} />
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

        {/* Recherche EN LIGNE depuis les onglets de navigation (l'Accueil a déjà la sienne) :
            vrai champ de saisie ; on tape directement, les résultats remplacent le contenu. */}
        {stack.length === 1 && ongletAvecRecherche && (
          <View style={{ paddingHorizontal: 18, marginTop: 12, marginBottom: 4 }}>
            <View
              style={{
                flexDirection: "row", alignItems: "center", gap: 11, height: 54,
                backgroundColor: C.surface, borderRadius: RADIUS.md, paddingLeft: 8, paddingRight: 15,
                borderWidth: 1, borderColor: C.borderStrong, ...shadowCard,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
                <Feather name="search" size={19} color="#fff" />
              </View>
              <TextInput
                value={gq}
                onChangeText={setGq}
                placeholder="Un sujet, un nom, une loi… ex. logement, santé, agriculture"
                placeholderTextColor={C.textMuted}
                style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
                autoCorrect={false}
              />
              {gq.length > 0 && (
                <TouchableOpacity onPress={() => setGq("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={18} color={C.textFaint} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {enRechercheGlobale ? (
            <SearchResultsList q={gq} nav={nav} onCorriger={setGq} />
          ) : (
            <>
          {current.name === "search" && <SearchScreen nav={nav} />}
          {current.name === "themes" && <ThemesScreen nav={nav} />}
          {current.name === "grandsScrutins" && <GrandsScrutinsScreen nav={nav} />}
          {current.name === "partis" && <PartisScreen nav={nav} />}
          {current.name === "parti" && <PartiScreen uid={current.uid} nav={nav} />}
          {current.name === "membresParti" && <MembresPartiScreen uid={current.uid} libelle={current.libelle} nav={nav} />}
          {current.name === "votesParti" && (
            <VotesPartiScreen uid={current.uid} libelle={current.libelle} categorie={current.categorie} categorieLibelle={current.categorieLibelle} position={current.position} periode={current.periode} nav={nav} />
          )}
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
          {current.name === "apropos" && <AProposScreen nav={nav} />}
          {current.name === "mentions" && <MentionsScreen />}
          {current.name === "confrontation" && <ConfrontationScreen a={current.a} b={current.b} periode={current.periode} hasard={current.hasard} nav={nav} />}
          {current.name === "confrontationListe" && (
            <ConfrontationListeScreen kind={current.kind} themeLibelle={current.themeLibelle} sousTitre={current.sousTitre} scrutins={current.scrutins} depA={current.depA} depB={current.depB} communs={current.communs} nav={nav} />
          )}
          {current.name === "monDepute" && <MonDeputeScreen nav={nav} />}
          {current.name === "parametres" && <ParametresScreen nav={nav} />}
          {current.name === "suivis" && <SuivisScreen nav={nav} />}
          {current.name === "testIntro" && <TestIntroScreen theme={current.theme} themeLibelle={current.themeLibelle} nav={nav} />}
          {current.name === "test" && <TestScreen mode={current.mode} theme={current.theme} themeLibelle={current.themeLibelle} nav={nav} />}
          {current.name === "testResultat" && <TestResultatScreen reponses={current.reponses} themesJoues={current.themesJoues} nav={nav} />}
            </>
          )}
        </View>

        {/* Bandeau d'installation PWA, en bas de l'Accueil (masqué si clavier ouvert) */}
        {root === "search" && !keyboardOpen && <InstallPrompt />}

        {/* Interstitiel pédagogique au 1er lancement (une fois par installation). */}
        <ParcoursLoi visible={interstitiel} onClose={() => setInterstitiel(false)} source="interstitiel" />

        {/* Barre d'onglets : positionnement d'origine (avant v1.0.25), paddingBottom fixe.
            Pas de viewport-fit=cover/safe-area (déréglait la position en app installée).
            Masquée quand le clavier est ouvert (sinon il la recouvre à moitié). */}
        {!keyboardOpen && (
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
        )}
      </View>
    </SafeAreaView>
  );
}
