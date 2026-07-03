import React from "react";
import { Modal, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Button } from "./ui";
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
            Réponds à de vrais votes de l'Assemblée. On te situe face à chaque groupe, thème par thème.
          </Text>

          <Button
            label="Commencer le test · 2 min"
            onPress={onStart}
            variant="primary"
            fullWidth
            iconLeft={<Feather name="check-circle" size={19} color="#fff" />}
            style={{ marginTop: 34 }}
          />

          <Button
            label="Explorer les votes d'abord"
            onPress={onExplore}
            variant="text"
            size="sm"
            style={{ marginTop: 18 }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
