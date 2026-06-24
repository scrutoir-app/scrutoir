import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { getPartis, getTestProximite } from "../api";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";
import { IntroQuestionMark } from "../components/IntroQuestionMark";
import { chargerTest } from "../testProximite/storage";
import { compterParTheme, themeTestActif, MSG_THEME_VERROUILLE } from "../testProximite/config";

/**
 * Écran d'accueil du test de proximité : l'animation du « ? » joue ici, puis le choix
 * du mode (un thème / test complet) et le bouton « Commencer ». Le thème d'origine, s'il
 * est fourni par le point d'entrée, présélectionne le mode « un thème ».
 */
export function TestIntroScreen({ theme, themeLibelle, nav }: { theme?: string; themeLibelle?: string; nav: Nav }) {
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [themeActif, setThemeActif] = useState(false);
  const [mode, setMode] = useState<"theme" | "complet">("complet"); // ajusté quand on connaît l'éligibilité du thème
  // Dernier résultat local (rien côté serveur) : proposé à la réouverture.
  const dernier = useMemo(() => chargerTest(), []);

  useEffect(() => { getPartis().then(setPartis); }, []);

  // Le thème d'origine n'est jouable en mono-thème que s'il a assez de questions validées.
  useEffect(() => {
    if (!theme) { setThemeActif(false); return; }
    getTestProximite()
      .then((qs) => {
        const actif = themeTestActif(compterParTheme(qs), theme);
        setThemeActif(actif);
        if (actif) setMode("theme"); // présélection « un thème » seulement s'il est débloqué
      })
      .catch(() => setThemeActif(false));
  }, [theme]);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {partis.length > 0 ? (
        <IntroQuestionMark groupes={partis} size={200} hideCta />
      ) : (
        <View style={{ height: 300, justifyContent: "center" }}>
          <ActivityIndicator color={C.textMuted} />
        </View>
      )}

      {dernier && Object.keys(dernier.reponses).length > 0 && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.push({ name: "testResultat", reponses: dernier.reponses, poids: dernier.poids })}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 15, marginTop: 6, marginBottom: 6, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
        >
          <Feather name="rotate-ccw" size={18} color={C.accent} />
          <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.text }]}>Revoir mon dernier résultat</Text>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}

      <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 4, marginBottom: 18 }]}>
        Réponds à quelques scrutins réels, on te dit de quels groupes tu es le plus proche.
      </Text>

      {/* Choix du mode — « un thème » désactivé si le thème est verrouillé (seuil non atteint). */}
      <ModeCard
        actif={mode === "theme"}
        disabled={!theme || !themeActif}
        titre={theme ? `Un thème : ${themeLibelle ?? theme}` : "Un thème"}
        sous={
          !theme
            ? "Ouvre le test depuis un thème pour l'activer"
            : themeActif
              ? "Les scrutins marquants de ce thème"
              : MSG_THEME_VERROUILLE
        }
        onPress={() => theme && themeActif && setMode("theme")}
      />
      <ModeCard
        actif={mode === "complet"}
        titre="Test complet"
        sous="Une dizaine de scrutins, tous thèmes confondus"
        onPress={() => setMode("complet")}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "test", mode, theme, themeLibelle })}
        style={{ marginTop: 22, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 15, alignItems: "center", ...shadowCard }}
      >
        <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Commencer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ModeCard({ actif, disabled, titre, sous, onPress }: { actif: boolean; disabled?: boolean; titre: string; sous: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.7}
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10,
        backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 15,
        borderWidth: 1.5, borderColor: actif ? C.accent : C.border, opacity: disabled ? 0.5 : 1, ...shadowCard,
      }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: actif ? C.accent : C.borderStrong, alignItems: "center", justifyContent: "center" }}>
        {actif && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent }} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{titre}</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>{sous}</Text>
      </View>
      {actif && <Feather name="check" size={18} color={C.accent} />}
    </TouchableOpacity>
  );
}
