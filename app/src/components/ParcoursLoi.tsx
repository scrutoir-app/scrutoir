import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS } from "../theme";
import { Card, Button } from "./ui";
import { track } from "../analytics";
import {
  ETAPES,
  GLOSSAIRE,
  GLOSSAIRE_TITRE,
  PARCOURS_BADGE,
  PARCOURS_INTRO,
  PARCOURS_TITRE,
} from "../content/parcoursLoi";

const AC = Animated.createAnimatedComponent(Circle);

/** Hémicycle qui se remplit siège par siège (clin d'œil à l'écran de lancement). Marque
 *  le moment « scrutin public ». `play` = lance le remplissage ; sinon tout est plein. */
function HemicycleFill({ play, anim }: { play: boolean; anim: Animated.Value[] }) {
  const W = 132;
  const H = 58;
  const seats = useMemo(() => {
    const cx = W / 2;
    const cy = H - 3;
    const out: { x: number; y: number }[] = [];
    const pitch = 11;
    for (let R = pitch * 1.2; R <= H + 4; R += pitch) {
      const n = Math.max(3, Math.round((Math.PI * R) / pitch));
      for (let k = 0; k <= n; k++) {
        const t = Math.PI * (k / n);
        const x = cx + R * Math.cos(t);
        const y = cy - R * Math.sin(t);
        if (x >= 3 && x <= W - 3 && y >= 3) out.push({ x, y });
      }
    }
    return out;
  }, []);
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {seats.map((s, i) => {
        const v = anim[i % anim.length];
        return (
          <AC
            key={i}
            cx={s.x}
            cy={s.y}
            r={2.4}
            fill={C.accent}
            opacity={play ? v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] }) : 1}
          />
        );
      })}
    </Svg>
  );
}

/**
 * « Parcours d'une loi » — schéma pédagogique inline, réutilisable, en surcouche.
 * Situe le SCRUTIN PUBLIC (seul objet affiché par Scrutoir) dans l'enchaînement
 * dépôt → commission → séance → vote → vote solennel → Sénat/promulgation, + glossaire.
 * 100 % local (aucun réseau/tiers), hors-ligne, sans son. Accent UNIQUE sur l'étape du vote.
 * `prefers-reduced-motion` respecté (tout lisible d'un coup, sans animation).
 */
export function ParcoursLoi({
  visible,
  onClose,
  source,
}: {
  visible: boolean;
  onClose: () => void;
  source: string;
}) {
  // Une valeur d'apparition par étape + valeurs de remplissage de l'hémicycle.
  const etapeVals = useRef(ETAPES.map(() => new Animated.Value(0))).current;
  const seatVals = useRef(Array.from({ length: 24 }, () => new Animated.Value(0))).current;
  const [hemiPlay, setHemiPlay] = React.useState(false);

  useEffect(() => {
    if (!visible) return;
    track("parcours_open", source);
    let on = true;
    setHemiPlay(false);
    etapeVals.forEach((v) => v.setValue(0));
    seatVals.forEach((v) => v.setValue(0));

    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!on) return;
      if (rm) {
        etapeVals.forEach((v) => v.setValue(1));
        seatVals.forEach((v) => v.setValue(1));
        setHemiPlay(false); // pas d'anim → hémicycle plein direct
        return;
      }
      setHemiPlay(true);
      // Révélation étape par étape (une fois).
      Animated.stagger(
        160,
        etapeVals.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: false })
        )
      ).start();
      // Remplissage de l'hémicycle quand on atteint l'étape du vote (index 3).
      const idxVote = ETAPES.findIndex((e) => e.scrutin);
      Animated.sequence([
        Animated.delay(160 * Math.max(0, idxVote) + 200),
        Animated.stagger(
          45,
          seatVals.map((v) =>
            Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false })
          )
        ),
      ]).start();
    });
    return () => {
      on = false;
    };
  }, [visible, source]);

  if (!visible) return null;

  const fermer = () => {
    track("parcours_close", source);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fermer} statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        onPress={fermer}
        style={{ flex: 1, backgroundColor: "rgba(10,12,15,0.5)", justifyContent: "center", padding: 18 }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: "center", width: "100%", maxWidth: 400 }}>
          <Card padding={0} radius={20} style={{ overflow: "hidden" }}>
            {/* En-tête */}
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 18, paddingBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[T.heading, { color: C.text }]}>{PARCOURS_TITRE}</Text>
                <Text style={[T.small, { color: C.textMuted, marginTop: 3, lineHeight: 18 }]}>{PARCOURS_INTRO}</Text>
              </View>
              <TouchableOpacity onPress={fermer} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Fermer" style={{ padding: 2 }}>
                <Feather name="x" size={20} color={C.textFaint} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
              {/* Timeline */}
              {ETAPES.map((e, i) => {
                const dernier = i === ETAPES.length - 1;
                const v = etapeVals[i];
                const aStyle = {
                  opacity: v,
                  transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
                };
                return (
                  <Animated.View key={i} style={[{ flexDirection: "row", gap: 12 }, aStyle]}>
                    {/* Colonne nœud + connecteur */}
                    <View style={{ alignItems: "center", width: 26 }}>
                      <View
                        style={{
                          width: 26, height: 26, borderRadius: 13,
                          alignItems: "center", justifyContent: "center",
                          backgroundColor: e.scrutin ? C.accent : C.surfaceAlt,
                          borderWidth: e.scrutin ? 0 : 1, borderColor: C.border,
                        }}
                      >
                        <Text style={{ fontFamily: F.bold, fontSize: 13, color: e.scrutin ? "#fff" : C.textMuted }}>{i + 1}</Text>
                      </View>
                      {!dernier && <View style={{ flex: 1, width: 2, backgroundColor: C.border, marginVertical: 2, minHeight: 14 }} />}
                    </View>

                    {/* Contenu de l'étape */}
                    <View style={{ flex: 1, paddingBottom: dernier ? 4 : 16 }}>
                      <Text style={[T.body, { fontFamily: F.bold, color: e.scrutin ? C.accent : C.text }]}>{e.titre}</Text>
                      <Text style={[T.small, { color: C.textMuted, marginTop: 2, lineHeight: 18 }]}>{e.def}</Text>
                      {e.scrutin && (
                        <View
                          style={{
                            marginTop: 10, borderRadius: RADIUS.md, padding: 12,
                            backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accent,
                            alignItems: "center", gap: 6,
                          }}
                        >
                          <HemicycleFill play={hemiPlay} anim={seatVals} />
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Feather name="eye" size={13} color={C.accent} />
                            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{PARCOURS_BADGE}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })}

              {/* Glossaire */}
              <View style={{ marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
                <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }]}>
                  {GLOSSAIRE_TITRE}
                </Text>
                {GLOSSAIRE.map((g) => (
                  <View key={g.mot} style={{ marginBottom: 12 }}>
                    <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{g.mot}</Text>
                    <Text style={[T.small, { color: C.textMuted, marginTop: 1, lineHeight: 18 }]}>{g.def}</Text>
                  </View>
                ))}
              </View>

              <Button
                label="J'ai compris"
                onPress={fermer}
                variant="primary"
                fullWidth
                style={{ marginTop: 6 }}
              />
            </ScrollView>
          </Card>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
