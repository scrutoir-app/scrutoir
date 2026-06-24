import React from "react";
import { View, Text, Image } from "react-native";
import { C, F, T, shadowCard } from "../theme";
import type { DeputeResume } from "../types";

/**
 * Barre compacte des deux élus confrontés, épinglée en haut au scroll. Un élu à
 * gauche, l'autre à droite (en miroir), une métrique au centre passée par l'écran
 * appelant (taux d'accord sur la confrontation, thème + taux de désaccord sur la
 * liste détaillée). Purement informative — aucune interaction.
 */
function Cote({ d, align }: { d: DeputeResume; align: "left" | "right" }) {
  return (
    <View style={{ flex: 1, minWidth: 0, flexDirection: align === "right" ? "row-reverse" : "row", alignItems: "center", gap: 8 }}>
      <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surfaceAlt }} />
      <View style={{ flex: 1, minWidth: 0, alignItems: align === "right" ? "flex-end" : "flex-start" }}>
        <Text numberOfLines={1} style={[T.small, { fontFamily: F.bold, color: C.text }]}>{d.nom_complet}</Text>
        <Text numberOfLines={1} style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]}>{d.abrev ?? "—"}</Text>
      </View>
    </View>
  );
}

export function DuelDeputesBar({ a, b, center }: { a: DeputeResume; b: DeputeResume; center: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: C.surface, borderBottomWidth: 0.5, borderBottomColor: C.borderStrong,
        paddingVertical: 9, paddingHorizontal: 12, ...shadowCard,
      }}
    >
      <Cote d={a} align="left" />
      <View style={{ flexShrink: 0, alignItems: "center" }}>{center}</View>
      <Cote d={b} align="right" />
    </View>
  );
}
