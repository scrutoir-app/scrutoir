import React, { useState } from "react";
import { Modal, View, Text, SafeAreaView, ScrollView, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, S, ICON, CONTROL, RADIUS, inputText } from "../theme";
import { Button } from "./ui";
import { ScrutoirLogo } from "./brand/ScrutoirLogo";
import { CarteSombre, TexteSombre } from "./installation";
import { useReduceMotion } from "./HeroScrutins";
import { track } from "../analytics";
import { importerTransfert, lireTexteTransfert } from "../testProximite/transfert";
import type { IssueColle, ModeColle } from "../mesureListes";

/**
 * Premier lancement de l'app installée sur iPhone / iPad, sans réponse (écran 4) : « Scrutoir est
 * installé ». L'app a son propre stockage, séparé de Safari : on propose de coller les réponses
 * copiées dans Safari (« Copier et installer », lien `#transfert=` ; un lien `#test=` marche aussi).
 * Le presse-papiers est lu sur le téléphone (iOS montre sa bulle « Coller ») : rien ne part au
 * réseau. Si la lecture est refusée ou indisponible, un champ permet de coller le lien à la main.
 * Le test reste à un toucher. Montré une fois (onboardingPrefs, `scrutoir.reprise.vue`).
 */

const RIEN = "Rien de Scrutoir dans ton presse-papiers. Retourne sur scrutoir.fr dans Safari, en bas de ton résultat touche « Copier et installer ».";

export function RepriseEcran({
  visible,
  onImporte,
  onStart,
  onExplore,
}: {
  visible: boolean;
  /** Réponses importées : ouvrir le résultat. */
  onImporte: () => void;
  onStart: () => void;
  onExplore: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const [message, setMessage] = useState<string | null>(null);
  const [champ, setChamp] = useState(false);
  const [saisie, setSaisie] = useState("");

  const traiter = (texte: string | null, mode: ModeColle): boolean => {
    const lu = lireTexteTransfert(texte);
    const issue: IssueColle = lu ? lu.type : "rien";
    track("transfert_colle", mode, issue);
    if (!lu || !importerTransfert(lu.donnees)) {
      setMessage(RIEN);
      return false;
    }
    onImporte();
    return true;
  };

  const coller = () => {
    setMessage(null);
    let lecture: Promise<string> | undefined;
    try {
      // Dans le geste, sans await avant : iOS affiche sa bulle « Coller ».
      lecture = typeof navigator !== "undefined" ? navigator.clipboard?.readText?.() : undefined;
    } catch {
      lecture = undefined;
    }
    if (!lecture) {
      track("transfert_colle", "presse_papiers", "refuse");
      setChamp(true);
      return;
    }
    lecture.then(
      (texte) => traiter(texte, "presse_papiers"),
      () => {
        track("transfert_colle", "presse_papiers", "refuse");
        setChamp(true);
      },
    );
  };

  return (
    <Modal visible={visible} animationType={reduceMotion ? "none" : "fade"} transparent={false} onRequestClose={onExplore}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: S.s20, paddingTop: S.s40, paddingBottom: S.s24, maxWidth: 480, width: "100%", alignSelf: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: "center" }}>
            <ScrutoirLogo variant="vertical" wordHeight={24} />
          </View>
          <Text accessibilityRole="header" style={[T.title, { color: C.text, textAlign: "center", fontSize: 26, lineHeight: 31, marginTop: S.s28 }]}>
            Scrutoir est installé
          </Text>
          <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: S.s8 }]}>
            Tes réponses restent ici, sur ton téléphone. Elles ne sont jamais envoyées à Scrutoir.
          </Text>

          <View style={{ marginTop: S.s24 }}>
            <CarteSombre titre="Tu as commencé le test dans Safari ?">
              <TexteSombre>Colle tes réponses copiées tout à l'heure. Ton spectre revient tel quel, sans passer par Scrutoir.</TexteSombre>
              <Button
                label="Coller mes réponses"
                onPress={coller}
                variant="citron"
                fullWidth
                iconLeft={<Feather name="clipboard" size={ICON.base} />}
                style={{ minHeight: CONTROL.lg }}
              />
              {champ ? (
                <View style={{ gap: S.s8 }}>
                  <TexteSombre petit>Colle le lien ici, puis touche « Valider ».</TexteSombre>
                  <TextInput
                    value={saisie}
                    onChangeText={setSaisie}
                    placeholder="https://scrutoir.fr/…"
                    placeholderTextColor={C.heroNeutre}
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Lien de tes réponses"
                    style={[inputText, { color: C.onHero, backgroundColor: C.heroGhost, borderRadius: RADIUS.sm, paddingHorizontal: S.s12, minHeight: CONTROL.md }]}
                  />
                  <Button
                    label="Valider"
                    onPress={() => traiter(saisie, "champ")}
                    variant="hero"
                    size="sm"
                    disabled={!saisie.trim()}
                    style={{ alignSelf: "flex-start", minHeight: CONTROL.md }}
                  />
                </View>
              ) : null}
              <View accessibilityLiveRegion="polite">
                {message ? (
                  <Text style={[T.small, { fontFamily: F.semibold, lineHeight: 18, color: C.onHero }]}>{message}</Text>
                ) : (
                  <TexteSombre petit>
                    Rien à coller ? Retourne sur scrutoir.fr dans Safari, en bas de ton résultat touche « Copier et installer ».
                  </TexteSombre>
                )}
              </View>
            </CarteSombre>
          </View>

          <View style={{ flex: 1, minHeight: S.s24 }} />
          <Button
            label="Commencer le test · 2 min"
            onPress={onStart}
            variant="primary"
            fullWidth
            iconLeft={<Feather name="check-circle" size={ICON.base} />}
            style={{ minHeight: CONTROL.lg }}
          />
          <Button label="Explorer les votes d'abord" onPress={onExplore} variant="text" muted style={{ marginTop: S.s8, minHeight: CONTROL.md }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
