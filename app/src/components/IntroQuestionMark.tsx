import React, { useRef, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { C, F, T, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { ownersFor, type GroupeGeo } from "./hemicycleGeo";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Repère FIXE (viewBox 0 0 220 300) mis à l'échelle de `size` (facteur size/220).
// Coordonnées EXACTES de la maquette validée (intro-test-proximite-animation.html) :
// la queue est posée à la main, surtout pas générée par une courbe/bézier.
const VBW = 220, VBH = 300;
const cx = 110, cyb = 120; // centre + ligne de base de la coupole
const RINGS = [62, 42]; // deux arcs (≠ géométrie du picto, ici en unités du viewBox 220)
const DOT_R = 4.6, FINAL_R = 7.6;
const GRIS_QUEUE = "#3C4654";

// Tempo identique à la maquette (secondes → ms).
const DOME_DUR = 950; // étalement de la coupole (délai = f * DOME_DUR)
const POP = 420; // durée d'apparition d'un point
const BASE = DOME_DUR + 180; // début de la queue (= 1130)
const ROW_STEP = 130; // décalage entre deux rangées
const FINAL_DELAY = BASE + ROW_STEP * 5 + 180; // le point du « ? » (= 1960)
const CAPTION_DELAY = FINAL_DELAY + 300; // fondu du titre + bouton
const POP_EASING = Easing.bezier(0.3, 0.9, 0.4, 1);

interface Pt { x: number; y: number; r: number; color: string; delay: number }

/**
 * Animation d'accueil du « test de proximité » : un « ? » qui se dessine en un geste.
 * Coupole = les deux arcs (colorés par groupe, même affectation gauche→droite que
 * HemicyclePicto via `ownersFor`). Queue = positions FIXES de la maquette validée
 * (viewBox 0 0 220 300). Chaque point « pop » (rayon + opacité). Ordre : coupole de
 * gauche (f=0) à droite, puis la queue de haut en bas, puis le point ; ensuite fondu
 * du titre « Et toi, tu votes comment ? » et du bouton « Commencer ».
 * Réf. : Brain « 01 - Projects/Scrutoir/intro-test-proximite-animation.html ».
 */
export function IntroQuestionMark({
  groupes,
  size = 200,
  onStart,
  hideCta = false,
}: {
  groupes: (GroupeGeo & { couleur?: string | null })[];
  size?: number;
  onStart?: () => void;
  /** Masque le bouton « Commencer » intégré (l'écran fournit alors son propre CTA). */
  hideCta?: boolean;
}) {
  const points = useMemo<Pt[]>(() => {
    const couleurDe = new Map(groupes.map((g) => [g.abrev, g.couleur ?? null]));
    const owners = ownersFor(groupes); // abrev par point, dans l'ordre des deux arcs

    // Coupole : x=cx+R·cos(πi/n), y=cyb-R·sin(πi/n) ; f=1-i/n (gauche→droite).
    const dome: Pt[] = [];
    RINGS.forEach((R, ri) => {
      const n = 9 - 2 * ri;
      for (let i = 0; i <= n; i++) {
        const t = Math.PI * (i / n);
        const f = 1 - i / n;
        dome.push({
          x: cx + R * Math.cos(t),
          y: cyb - R * Math.sin(t),
          r: DOT_R,
          color: (owners[dome.length] && couleurGroupe(couleurDe.get(owners[dome.length]!))) || C.siege,
          delay: f * DOME_DUR,
        });
      }
    });

    // Queue : 10 points, deux par rangée, positions EXACTES (espacement vertical 21).
    const rows: { y: number; xs: number[] }[] = [
      { y: 141, xs: [140, 160] },
      { y: 162, xs: [120, 140] },
      { y: 183, xs: [100, 120] },
      { y: 204, xs: [100, 120] },
      { y: 225, xs: [100, 120] },
    ];
    const queue: Pt[] = [];
    rows.forEach((row, idx) => {
      for (const x of row.xs) queue.push({ x, y: row.y, r: DOT_R, color: GRIS_QUEUE, delay: BASE + idx * ROW_STEP });
    });

    // Point final centré dessous, plus gros.
    const final: Pt = { x: cx, y: 254, r: FINAL_R, color: GRIS_QUEUE, delay: FINAL_DELAY };

    return [...dome, ...queue, final];
  }, [groupes]);

  // Une valeur par point (29 = 18 coupole + 10 queue + 1 final) + le titre/bouton.
  const vals = useRef(points.map(() => new Animated.Value(0))).current;
  const titre = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!on) return;
      if (rm) {
        vals.forEach((v) => v.setValue(1));
        titre.setValue(1);
        return;
      }
      Animated.parallel(
        points.map((p, i) =>
          Animated.sequence([
            Animated.delay(p.delay),
            Animated.timing(vals[i], { toValue: 1, duration: POP, easing: POP_EASING, useNativeDriver: false }),
          ])
        )
      ).start();
      Animated.sequence([
        Animated.delay(CAPTION_DELAY),
        Animated.timing(titre, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      ]).start();
    });
    return () => { on = false; };
  }, []);

  const w = size;
  const h = (size * VBH) / VBW; // échelle uniforme du viewBox

  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={w} height={h} viewBox={`0 0 ${VBW} ${VBH}`}>
        {points.map((p, i) => (
          <AnimatedCircle
            key={i}
            cx={p.x}
            cy={p.y}
            fill={p.color}
            // pop = scale 0 → 1.18 (à 60 %) → 1, rendu via le rayon ; opacité 0 → 1 à 60 %.
            r={vals[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1.18 * p.r, p.r] })}
            opacity={vals[i].interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] })}
          />
        ))}
      </Svg>

      <Animated.View style={{ opacity: titre, alignItems: "center", marginTop: 18 }}>
        <Text style={[T.title, { fontFamily: F.extra, color: C.text, textAlign: "center" }]}>
          Et toi, tu votes comment ?
        </Text>
        {!hideCta && (
          <TouchableOpacity
            onPress={onStart}
            activeOpacity={0.85}
            style={{ marginTop: 16, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 26, paddingVertical: 13, ...shadowCard }}
          >
            <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Commencer</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}
