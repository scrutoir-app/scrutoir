import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Button } from "./ui";

/**
 * État d'erreur de chargement commun à tous les écrans (couplé au hook useData) :
 * message clair + bouton « Réessayer », au lieu d'une page blanche silencieuse.
 * Le message ne distingue pas les causes (hors-ligne, 404, JSON) — pour
 * l'utilisateur la réponse est la même : réessayer quand le réseau revient.
 */
export function ErreurChargement({ onRetry, compact }: { onRetry: () => void; compact?: boolean }) {
  return (
    <View
      style={{
        flex: compact ? undefined : 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 30,
        paddingVertical: compact ? 24 : 0,
      }}
    >
      <Feather name="wifi-off" size={26} color={C.textFaint} />
      <Text style={[T.body, { fontFamily: F.bold, color: C.text, textAlign: "center", marginTop: 12 }]}>
        Impossible de charger les données
      </Text>
      <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 5 }]}>
        Vérifie ta connexion, puis réessaie.
      </Text>
      <Button
        label="Réessayer"
        onPress={onRetry}
        variant="primary"
        size="sm"
        accessibilityLabel="Réessayer le chargement"
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
