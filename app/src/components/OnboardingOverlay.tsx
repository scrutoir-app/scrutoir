import React from "react";
import { Modal, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { ScrutoirLogo } from "./brand/ScrutoirLogo";

/**
 * Overlay d'onboarding première connexion (recentrage « je »). Modal PLEIN ÉCRAN, opaque :
 * l'accueil ne transparaît pas derrière. CTA principal = lancer le test ; deux sorties douces
 * (explorer / plus tard). La visibilité et la persistance sont pilotées par onboardingPrefs.
 */
export function OnboardingOverlay({
  visible,
  onStart,
  onExplore,
  onClose,
}: {
  visible: boolean;
  onStart: () => void;
  onExplore: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, paddingHorizontal: 26, justifyContent: "center", maxWidth: 480, width: "100%", alignSelf: "center" }}>
          {/* « Plus tard » discret, en haut à droite. */}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ position: "absolute", top: 14, right: 22, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>Plus tard</Text>
            <Feather name="x" size={16} color={C.textMuted} />
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <ScrutoirLogo variant="vertical" wordHeight={30} />
          </View>

          <Text style={[T.title, { fontFamily: F.extra, color: C.text, textAlign: "center", fontSize: 26, lineHeight: 31 }]}>
            Et toi, tu votes comment ?
          </Text>
          <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: 12 }]}>
            Réponds à quelques scrutins réels de l'Assemblée. On te dit ensuite de quels groupes
            et de quels députés tu es le plus proche — un spectre, jamais un verdict.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onStart}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 34, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 16, ...shadowCard }}
          >
            <Feather name="check-circle" size={19} color="#fff" />
            <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Commencer le test · 2 min</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} onPress={onExplore} style={{ alignItems: "center", marginTop: 18 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Explorer les votes d'abord</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
