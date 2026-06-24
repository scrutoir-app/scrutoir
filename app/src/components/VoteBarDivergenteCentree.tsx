import React, { useRef, useEffect, useState } from "react";
import { View, Animated, Easing, LayoutChangeEvent, AccessibilityInfo } from "react-native";
import { C } from "../theme";

// Hémicycle de l'Assemblée nationale (17e législature). L'échelle des deux camps
// est la demi-assemblée : la moitié de piste (du bord à l'axe) = SIEGES_TOTAL / 2.
const SIEGES_TOTAL = 577;
const DUREE = 1900; // ms — ouverture des trois segments depuis le centre

/**
 * Barre divergente à abstention CENTRÉE sur l'axe (carte hero uniquement). Le
 * « pour » se déploie vers la gauche, le « contre » vers la droite, l'abstention
 * occupe le centre à cheval sur l'axe (largeur = sa part des exprimés, bornée à
 * 30 %). Échelle = demi-assemblée : une barre courte sur piste longue signale une
 * faible participation. Les trois segments s'ouvrent ensemble depuis le centre.
 *
 * Distincte de `BarreDivergente` (listes de thèmes, échelle relative aux exprimés),
 * qui reste utilisée telle quelle ailleurs. Géométrie animée en pixels (largeur
 * mesurée via onLayout) → useNativeDriver:false ; l'animation de chaîne « % » ne
 * s'anime pas de façon fiable sur react-native-web.
 */
export function VoteBarDivergenteCentree({
  pour,
  contre,
  abstention,
  siegesTotal = SIEGES_TOTAL,
  height = 10,
  active = true,
}: {
  pour: number;
  contre: number;
  abstention: number;
  siegesTotal?: number;
  height?: number;
  /** Rejoue l'ouverture à chaque passage à true (ex. carte du carrousel affichée). */
  active?: boolean;
}) {
  const exprimes = pour + contre + abstention || 1;
  const abstFrac = Math.min(0.3, abstention / exprimes); // part d'abstention (bornée à 30 %)
  const demiZoneFrac = 0.5 - abstFrac / 2; // fraction de piste par camp, hors abstention
  const demi = siegesTotal / 2;
  const pourFrac = demiZoneFrac * Math.min(1, pour / demi);
  const contreFrac = demiZoneFrac * Math.min(1, contre / demi);

  // Tokens thème = rgba(60,70,84,0.13) / 0.40 en clair (valeurs de la maquette),
  // mais clairs-sur-sombre en mode sombre → la piste reste lisible (sa longueur
  // porte le repère de participation).
  const piste = C.watermarkFocal;
  const axe = C.hairlineStrong;
  const r = height / 2;

  // Largeur réelle de la piste, mesurée → géométrie en pixels (anim fiable sur web).
  const [tw, setTw] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== tw) setTw(w);
  };

  const half = tw / 2;
  const abstPx = tw * abstFrac;
  const interne = half + abstPx / 2; // distance du bord droit (pour) / bord gauche (contre) au bord externe

  // Une seule valeur 0 → 1 pilote l'ouverture simultanée des trois segments. Rejouée
  // à chaque fois que la carte devient visible (active). reduce-motion : saut direct
  // à l'état final (cohérent avec le reste de l'app).
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { progress.setValue(0); return; } // prête à rejouer au prochain affichage
    let on = true;
    let anim: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (!on) return;
      if (rm) return progress.setValue(1);
      progress.setValue(0);
      anim = Animated.timing(progress, {
        toValue: 1,
        duration: DUREE,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      anim.start();
    });
    return () => { on = false; anim?.stop(); };
  }, [active]);

  const largeur = (frac: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, tw * frac] });

  return (
    <View onLayout={onLayout} style={{ height, justifyContent: "center" }}>
      {/* Piste neutre, arrondie aux deux extrémités */}
      <View style={{ position: "absolute", left: 0, right: 0, height, borderRadius: r, backgroundColor: piste }} />

      {/* Pour : bord droit ancré au bord gauche de l'abstention, grandit vers la GAUCHE */}
      <Animated.View
        style={{
          position: "absolute",
          right: interne,
          height,
          width: largeur(pourFrac),
          backgroundColor: C.pour,
          borderTopLeftRadius: r,
          borderBottomLeftRadius: r,
        }}
      />

      {/* Contre : bord gauche ancré au bord droit de l'abstention, grandit vers la DROITE */}
      <Animated.View
        style={{
          position: "absolute",
          left: interne,
          height,
          width: largeur(contreFrac),
          backgroundColor: C.contre,
          borderTopRightRadius: r,
          borderBottomRightRadius: r,
        }}
      />

      {/* Abstention : centrée à cheval sur l'axe, s'ouvre symétriquement depuis le centre */}
      <Animated.View
        style={{
          position: "absolute",
          left: progress.interpolate({ inputRange: [0, 1], outputRange: [half, half - abstPx / 2] }),
          height,
          width: largeur(abstFrac),
          backgroundColor: C.abstention,
        }}
      />

      {/* Axe central exact */}
      <View style={{ position: "absolute", left: "50%", marginLeft: -0.75, width: 1.5, height: height + 3, backgroundColor: axe }} />
    </View>
  );
}
