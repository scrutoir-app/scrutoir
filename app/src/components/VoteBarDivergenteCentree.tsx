import React, { useRef, useEffect, useState } from "react";
import { View, Text, Animated, Easing, LayoutChangeEvent, AccessibilityInfo } from "react-native";
import { C, F, T, tnum } from "../theme";

// Hémicycle de l'Assemblée nationale (17e législature). L'échelle des deux camps
// est la demi-assemblée : la moitié de piste (du bord à l'axe) = SIEGES_TOTAL / 2.
const SIEGES_TOTAL = 577;
const DUREE = 1900; // ms — ouverture des segments + décompte des voix

/**
 * Barre divergente à abstention CENTRÉE sur l'axe (carte hero). Le « pour » se
 * déploie vers la gauche, le « contre » vers la droite, l'abstention occupe le
 * centre à cheval sur l'axe (largeur = sa part des exprimés, bornée à 30 %).
 * Échelle = demi-assemblée : une barre courte sur piste longue = faible participation.
 * Style « capsules » : piste de fond unique + trois capsules indépendantes par-dessus,
 * avec un léger jour de part et d'autre de l'abstention. Au-dessus, l'« écart de voix » ;
 * en dessous, les trois décomptes — tous animés de 0 à leur valeur, synchronisés avec
 * le remplissage (même durée, même easing).
 *
 * Distincte de `BarreDivergente` / `VoteBarDivergenteInline` (listes de thèmes, échelle
 * relative aux exprimés), inchangées. Géométrie animée en pixels (largeur mesurée via
 * onLayout) → useNativeDriver:false ; l'interpolation de chaîne « % » ne s'anime pas de
 * façon fiable sur react-native-web.
 */
export function VoteBarDivergenteCentree({
  pour,
  contre,
  abstention,
  siegesTotal = SIEGES_TOTAL,
  height = 16,
  active = true,
  ecart: avecEcart = false,
  decompte = false,
}: {
  pour: number;
  contre: number;
  abstention: number;
  siegesTotal?: number;
  height?: number;
  /** Rejoue l'ouverture (+ écart/décompte) à chaque passage à true (carte du carrousel). */
  active?: boolean;
  /** Affiche « écart de N voix » au-dessus (animé). Défaut : non (barre seule). */
  ecart?: boolean;
  /** Affiche le décompte « N pour / N abst. / N contre » sous la barre (animé). Défaut : non. */
  decompte?: boolean;
}) {
  const exprimes = pour + contre + abstention || 1;
  const abstFrac = Math.min(0.3, abstention / exprimes); // part d'abstention (bornée à 30 %)
  const demiZoneFrac = 0.5 - abstFrac / 2; // fraction de piste par camp, hors abstention
  const demi = siegesTotal / 2;
  const pourFrac = demiZoneFrac * Math.min(1, pour / demi);
  const contreFrac = demiZoneFrac * Math.min(1, contre / demi);
  const ecart = Math.abs(pour - contre);

  const r = height / 2;
  // rgba(60,70,84,0.10) en clair (valeur de la maquette) ; clair-sur-sombre en mode
  // sombre → la piste reste lisible (sa longueur porte le repère de participation).
  const piste = C.hairline;

  // Largeur réelle de la piste, mesurée → géométrie en pixels (anim fiable sur web).
  const [tw, setTw] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== tw) setTw(w);
  };

  // Une seule valeur 0 → 1 pilote l'ouverture des capsules ET le décompte des voix.
  const progress = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState({ p: 0, a: 0, c: 0, e: 0 });

  // Décompte : nombres arrondis à l'affichage, suivant la même valeur que le remplissage.
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setDisp({
        p: Math.round(value * pour),
        a: Math.round(value * abstention),
        c: Math.round(value * contre),
        e: Math.round(value * ecart),
      });
    });
    return () => progress.removeListener(id);
  }, [pour, contre, abstention, ecart]);

  // Animation rejouée à chaque fois que la carte devient visible (active). reduce-motion
  // → saut direct à l'état final (cohérent avec le reste de l'app).
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

  const half = tw / 2;
  const abstPx = tw * abstFrac;
  const jour = tw * 0.01; // ~1 % de jour de chaque côté du bloc abstention
  const interne = half + abstPx / 2 + jour; // bord interne des capsules pour / contre
  const largeur = (frac: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [0, tw * frac] });

  return (
    <View
      // La couleur seule est muette pour un lecteur d'écran : on dit les chiffres
      // (même règle que l'aria-label des pages SEO).
      accessible
      accessibilityLabel={`${pour} pour, ${contre} contre, ${abstention} abstentions`}
    >
      {/* Écart de voix, au-dessus, centré, discret (optionnel) */}
      {avecEcart && (
        <Text style={[T.micro, tnum, { textAlign: "center", color: C.textMuted, marginBottom: 6 }]}>
          écart de {disp.e} voix
        </Text>
      )}

      {/* Piste de fond unique + trois capsules indépendantes par-dessus */}
      <View onLayout={onLayout} style={{ height, justifyContent: "center" }}>
        <View style={{ position: "absolute", left: 0, right: 0, height, borderRadius: r, backgroundColor: piste }} />

        {/* Pour : capsule ancrée à droite (jour avant l'abstention), grandit vers la GAUCHE */}
        <Animated.View style={{ position: "absolute", right: interne, height, width: largeur(pourFrac), borderRadius: r, backgroundColor: C.pour }} />

        {/* Contre : capsule ancrée à gauche (jour après l'abstention), grandit vers la DROITE */}
        <Animated.View style={{ position: "absolute", left: interne, height, width: largeur(contreFrac), borderRadius: r, backgroundColor: C.contre }} />

        {/* Abstention : capsule centrée à cheval sur l'axe, s'ouvre symétriquement */}
        <Animated.View
          style={{
            position: "absolute",
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [half, half - abstPx / 2] }),
            height,
            width: largeur(abstFrac),
            borderRadius: r,
            backgroundColor: C.abstention,
          }}
        />
      </View>

      {/* Décompte des voix : pour (gauche) · abst. (centre) · contre (droite) — optionnel */}
      {decompte && (
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <Text style={[T.small, tnum, { flex: 1, textAlign: "left", fontFamily: F.semibold, color: C.pour }]}>{disp.p} pour</Text>
          <Text style={[T.small, tnum, { flex: 1, textAlign: "center", fontFamily: F.semibold, color: C.abstention }]}>{disp.a} abst.</Text>
          <Text style={[T.small, tnum, { flex: 1, textAlign: "right", fontFamily: F.semibold, color: C.contre }]}>{disp.c} contre</Text>
        </View>
      )}
    </View>
  );
}
