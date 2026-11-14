// Carte d'entrée de la rubrique sur l'accueil : aucun parti, aucun drapeau. Le titre en grand sur
// un fond guilloché (lignes ondulées d'un document officiel, encre à 9 %, token `guilloche`),
// seul motif de l'app. Rendue seulement si un programme est en service (cf. AccueilAccordsScreen).
import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../../theme";
import { Pression } from "./primitives";

const HAUTEUR = 168;
const NB_LIGNES = 16;

/** Lignes du guillochage : sommes de sinusoïdes, déterministes (même dessin à chaque ouverture). */
export function lignesGuilloche(largeur: number, hauteur = HAUTEUR): string[] {
  const out: string[] = [];
  for (let i = 0; i < NB_LIGNES; i++) {
    const base = hauteur * (0.18 + (0.7 * i) / (NB_LIGNES - 1));
    const a1 = 7 + 3 * Math.sin(i * 0.9);
    const a2 = 3.5 + 1.5 * Math.cos(i * 0.6);
    const ph = i * 0.42;
    const pts: string[] = [];
    for (let x = 0; x <= largeur + 4; x += 4) {
      const y = base + a1 * Math.sin(x / 44 + ph) + a2 * Math.sin(x / 19 - 2 * ph) - 6 * Math.sin((x / largeur) * Math.PI) * Math.cos(i * 0.5);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    out.push(pts.join(" "));
  }
  return out;
}

export function CartePresidentielle({ onPress }: { onPress: () => void }) {
  const [w, setW] = useState(358);
  const lignes = useMemo(() => lignesGuilloche(w), [w]);
  return (
    <Pression
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Présidentielle 2027 : les programmes face aux votes. Voir"
      style={{
        height: HAUTEUR,
        borderRadius: RADIUS.xl,
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.borderStrong,
        overflow: "hidden",
        ...shadowCard,
      }}
    >
      <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <Svg width={w} height={HAUTEUR} viewBox={`0 0 ${w} ${HAUTEUR}`}>
          {lignes.map((p, i) => (
            <Polyline key={i} points={p} fill="none" stroke={C.guilloche} strokeWidth={0.8} />
          ))}
        </Svg>
      </View>
      <View style={{ flex: 1, padding: 18 }}>
        {/* 30 px : taille de la maquette validée (hors échelle T, comme les grands nombres de PctCard). */}
        <Text style={{ fontFamily: F.extra, fontSize: 30, lineHeight: 31, letterSpacing: -1, color: C.text }}>{"Présidentielle\n2027"}</Text>
        <View style={{ marginTop: "auto", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, backgroundColor: C.surface }]}>{"Les programmes\nface aux votes"}</Text>
          <View style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.text, flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.bg }]}>Voir</Text>
            <Feather name="chevron-right" size={18} color={C.bg} />
          </View>
        </View>
      </View>
    </Pression>
  );
}
