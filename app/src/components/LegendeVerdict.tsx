import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { C, F, T, RADIUS, S, shadowCard } from "../theme";
import { Button } from "./ui";
import { VerdictPastille } from "./VerdictPastille";
import { useReduceMotion } from "./HeroScrutins";

/**
 * Légende explicative du verdict, en TROIS pages, non bloquante (fermeture possible) et
 * rattrapable partout (le lien « Comment on déduit » du tiroir de vote l'ouvre en page 2).
 * Page 1 : ce que tu as tranché (pastille pleine). Page 2 : ce qu'on déduit de ton profil
 * (pointillés) + note d'honnêteté. Page 3 : corriger une déduction, avec une courte animation
 * en boucle (état final figé si animations réduites). Points de progression + Suivant / Retour /
 * J'ai compris.
 */
const CENTRE = { alignSelf: "center" as const };

export function LegendeVerdict({ visible, onClose, pageInitiale = 0 }: { visible: boolean; onClose: () => void; pageInitiale?: number }) {
  const [page, setPage] = useState(pageInitiale);
  useEffect(() => {
    if (visible) setPage(pageInitiale);
  }, [visible, pageInitiale]);

  const titre = (t: string) => <Text accessibilityRole="header" style={[T.heading, { color: C.text, textAlign: "center" }]}>{t}</Text>;
  const texte = (t: string) => <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s8, lineHeight: 20 }]}>{t}</Text>;
  const note = (t: string) => <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: S.s16, lineHeight: 17 }]}>{t}</Text>;

  const P1 = (
    <>
      {titre("Ce que tu as tranché")}
      {texte("Au test ou depuis un scrutin, on compare ta vraie réponse au résultat. Pastille pleine, avec une coche.")}
      <View style={{ gap: S.s8, marginTop: S.s16, alignItems: "center" }}>
        <VerdictPastille verdict={{ niveau: "vote", sens: "align" }} style={CENTRE} />
        <VerdictPastille verdict={{ niveau: "vote", sens: "oppose" }} style={CENTRE} />
        <VerdictPastille verdict={{ niveau: "sans_avis", sens: null }} style={CENTRE} />
      </View>
      {note("Un « sans avis » ne reçoit plus aucune déduction.")}
    </>
  );

  const P2 = (
    <>
      {titre("Ce qu'on déduit de ton profil")}
      {texte("Sur les autres, on estime de quel côté tu penches à partir de ton profil. Contour en pointillés.")}
      <View style={{ gap: S.s8, marginTop: S.s16, alignItems: "center" }}>
        <VerdictPastille verdict={{ niveau: "deduit", sens: "align" }} style={CENTRE} />
        <VerdictPastille verdict={{ niveau: "deduit", sens: "oppose" }} style={CENTRE} />
        <VerdictPastille verdict={{ niveau: "deduit", sens: "partage" }} style={CENTRE} />
      </View>
      {note("C'est une estimation, pas un vote que tu as posé. Elle se trompe parfois, et c'est à toi de la corriger.")}
    </>
  );

  const P3 = (
    <>
      {titre("Pas d'accord ? Corrige-la.")}
      {texte(
        "Touche une pastille en pointillés et dis ce que tu aurais voté. Ta réponse remplace la déduction : la pastille devient pleine et ta réponse entre dans le calcul de ta proximité avec les groupes, sauf sur les budgets et les motions."
      )}
      <AnimationCorrection />
      {note("Tu effaces une réponse quand tu veux.")}
    </>
  );

  if (!visible) return null;
  const derniere = page === 2;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 80, alignItems: "center", justifyContent: "center", padding: S.s18 }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fermer la légende"
        style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
      />
      <View
        accessibilityViewIsModal
        role="dialog"
        aria-label="Légende du verdict"
        style={{
          width: "100%",
          maxWidth: 380,
          backgroundColor: C.surface,
          borderRadius: RADIUS.xl,
          padding: S.s24,
          ...shadowCard,
        }}
      >
        {page === 0 ? P1 : page === 1 ? P2 : P3}

        {/* Points de progression */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: S.s8, marginTop: S.s24 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === page ? 20 : 7,
                height: 7,
                borderRadius: RADIUS.pill,
                backgroundColor: i === page ? C.accent : C.borderStrong,
              }}
            />
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: S.s8, marginTop: S.s16 }}>
          {page > 0 && (
            <Button label="Retour" variant="outline" size="md" onPress={() => setPage(page - 1)} style={{ flex: 1 }} />
          )}
          <Button
            label={derniere ? "J'ai compris" : "Suivant"}
            variant="primary"
            size="md"
            onPress={() => (derniere ? onClose() : setPage(page + 1))}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Page 3 : une pastille « Comme toi » en pointillés est touchée (cercle ardoise qui s'efface), la
 * rangée Contre / Sans avis / Pour monte, Pour se surligne, la rangée s'efface, fondu croisé vers
 * « Pas comme ton vote » plein. Boucle de 5,2 s (maquette, artboard 3). Animations réduites :
 * l'état final, figé.
 */
function AnimationCorrection() {
  const reduce = useReduceMotion();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) return;
    t.setValue(0);
    // Couleurs interpolées : pas de pilote natif (le web l'ignore de toute façon).
    const boucle = Animated.loop(Animated.timing(t, { toValue: 1, duration: 5200, easing: Easing.linear, useNativeDriver: false }));
    boucle.start();
    return () => boucle.stop();
  }, [reduce, t]);

  const lent = Easing.bezier(0.77, 0, 0.175, 1);
  const sortie = Easing.bezier(0.23, 1, 0.32, 1);
  const k = (inputRange: number[], outputRange: number[] | string[], easing: (v: number) => number) =>
    t.interpolate({ inputRange, outputRange: outputRange as number[], easing, extrapolate: "clamp" });

  const avant = reduce ? 0 : k([0, 0.58, 0.66, 0.94, 1], [1, 1, 0, 0, 1], lent);
  const apres = reduce ? 1 : k([0, 0.58, 0.66, 0.94, 1], [0, 0, 1, 1, 0], lent);
  const toucheO = reduce ? 0 : k([0, 0.16, 0.2, 0.28, 1], [0, 0, 0.5, 0, 0], sortie);
  const toucheS = reduce ? 1 : k([0, 0.16, 0.2, 0.28, 1], [0.6, 0.6, 1, 1.5, 1.5], sortie);
  const rangeeO = reduce ? 0 : k([0, 0.24, 0.32, 0.54, 0.62, 1], [0, 0, 1, 1, 0, 0], sortie);
  const rangeeY = reduce ? 0 : k([0, 0.24, 0.32, 0.54, 0.62, 1], [10, 10, 0, 0, 6, 6], sortie);
  const ease = Easing.ease;
  const pourFond = reduce ? C.surface : t.interpolate({ inputRange: [0, 0.4, 0.46, 1], outputRange: [C.surface, C.surface, C.adopteBg, C.adopteBg], easing: ease });
  const pourBord = reduce ? C.borderStrong : t.interpolate({ inputRange: [0, 0.4, 0.46, 1], outputRange: [C.borderStrong, C.borderStrong, C.pour, C.pour], easing: ease });

  const centre = { position: "absolute" as const, left: 0, right: 0, top: S.s20, alignItems: "center" as const };
  const case_ = { flex: 1, minHeight: 40, borderRadius: RADIUS.sm, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: C.surface };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Animation : une pastille Comme toi en pointillés est touchée, le choix Pour est retenu, elle devient une pastille pleine Pas comme ton vote"
      style={{ width: "100%", height: 150, marginTop: S.s16, borderRadius: RADIUS.md, backgroundColor: C.bg, overflow: "hidden" }}
    >
      <View importantForAccessibility="no-hide-descendants" aria-hidden style={{ flex: 1 }}>
        <Animated.View style={[centre, { opacity: avant }]}>
          <VerdictPastille verdict={{ niveau: "deduit", sens: "align" }} style={CENTRE} />
        </Animated.View>
        <Animated.View style={[centre, { opacity: apres }]}>
          <VerdictPastille verdict={{ niveau: "vote", sens: "oppose" }} style={CENTRE} />
        </Animated.View>
        <Animated.View style={[centre, { top: S.s20 + 2 }]} pointerEvents="none">
          <Animated.View style={{ width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: C.accent, opacity: toucheO, transform: [{ scale: toucheS }] }} />
        </Animated.View>
        <Animated.View
          style={{ position: "absolute", left: S.s16, right: S.s16, bottom: S.s16, flexDirection: "row", gap: S.s8, opacity: rangeeO, transform: [{ translateY: rangeeY }] }}
        >
          <View style={[case_, { borderWidth: 1.5, borderStyle: "dashed", borderColor: C.contre }]}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Contre</Text>
          </View>
          <View style={[case_, { borderWidth: 1.5, borderColor: C.borderStrong }]}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Sans avis</Text>
          </View>
          <Animated.View style={[case_, { borderWidth: 2, backgroundColor: pourFond, borderColor: pourBord }]}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Pour</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}
