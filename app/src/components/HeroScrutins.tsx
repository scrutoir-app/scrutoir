import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, FlatList, Animated, Easing, AccessibilityInfo,
  LayoutChangeEvent, useWindowDimensions, Platform,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, formatDate, getScheme } from "../theme";
import { Card, Chip } from "./ui";
import { catUI } from "../categoryUI";
import { HemicycleSeats } from "./HemicycleSeats";
import { VoteBarDivergenteCentree } from "./VoteBarDivergenteCentree";
import type { ScrutinResume } from "../types";

const GAP = 12;
const SIDE = 18; // marge écran (alignée sur le contenu de l'accueil)
const HERO_H = 222; // hauteur fixe de la carte (carrousel uniforme + centrage des flèches)
const ANIM_BAR = 850; // ms — barre de vote
const ANIM_FADE = 450; // ms — filigrane

/** Type de texte court (« kicker ») dérivé du libellé / type de vote. */
function kicker(s: ScrutinResume): string {
  const tv = (s.type_vote ?? "").toLowerCase();
  if (tv.includes("motion de censure")) return "Motion de censure";
  const t = (s.titre ?? "").toLowerCase();
  if (t.includes("proposition de loi")) return "Proposition de loi";
  if (t.includes("projet de loi")) return "Projet de loi";
  return "Scrutin solennel";
}

/** Reduce-motion système (avec écoute des changements). */
export function useReduceMotion(): boolean {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (on) setRm(!!v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setRm);
    return () => { on = false; sub?.remove?.(); };
  }, []);
  return rm;
}

/**
 * Carte « hero » signature (sans photo) : fond blanc, filigrane hémicycle en coin,
 * barre de vote et compteurs animés (0 → valeur) à l'apparition de la slide.
 * Réutilisée hors carrousel (liste verticale « Récents » de l'onglet Scrutins) :
 * `active` pilote l'animation, déclenchée quand la carte entre à l'écran.
 */
export function HeroCard({
  s, width, active, reduceMotion, onPress,
}: {
  s: ScrutinResume;
  width: number;
  active: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const adopte = s.sort_code === "adopte";
  const p = s.pour ?? 0, c = s.contre ?? 0, a = s.abstention ?? 0;
  const votants = p + c + a;
  const tot = votants || 1;
  const ui = s.categorie ? catUI(s.categorie) : catUI("");

  const progress = useRef(new Animated.Value(0)).current; // 0 → 1 (compteurs animés)
  const fade = useRef(new Animated.Value(0)).current; // filigrane
  const seen = useRef(false);
  const [votantsDisp, setVotantsDisp] = useState(0); // total animé (le détail pour/abst/contre est dans la barre)

  // Compteur du total : listener attaché pour TOUTE la vie de la carte.
  useEffect(() => {
    const id = progress.addListener(({ value }) => setVotantsDisp(Math.round(value * votants)));
    return () => progress.removeListener(id);
  }, []);

  // À chaque apparition de la slide : les compteurs repartent de 0. Le filigrane ne
  // fait son fondu qu'une fois (seen). reduce-motion → valeurs finales immédiates.
  useEffect(() => {
    if (!active) return;
    if (reduceMotion) {
      progress.setValue(1);
      fade.setValue(1);
      return;
    }
    if (!seen.current) {
      seen.current = true;
      Animated.timing(fade, { toValue: 1, duration: ANIM_FADE, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: ANIM_BAR, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [active]);

  return (
    <Card
      onPress={onPress}
      activeOpacity={0.92}
      radius={RADIUS.lg}
      padding={0}
      raised
      style={{
        width, height: HERO_H, overflow: "hidden",
        // Surface volontairement plus claire en sombre (panneau surélevé, plus lisible
        // que C.surface qui se fond dans le fond encre). Inchangée en clair (déjà blanc).
        backgroundColor: getScheme() === "dark" ? "#222A35" : C.surface,
        borderWidth: 0.5, borderColor: getScheme() === "dark" ? C.borderStrong : C.border,
      }}
    >
      {/* Filigrane : hémicycle peuplé de sièges = les députés (suggestion simplifiée),
          ancré en bas-centre, balaie toute la carte, très discret. Fondu à l'apparition. */}
      <Animated.View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: fade }}
        pointerEvents="none"
      >
        <HemicycleSeats width={width} height={HERO_H} color={C.watermarkInk} pitch={38} />
      </Animated.View>

      <View style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
        {/* Haut : chip catégorie + date */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
            <MaterialCommunityIcons name={ui.icon as any} size={14} color={C.accent} />
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{ui.court ?? "Scrutin"}</Text>
          </View>
          <Text style={[T.small, { color: C.textMuted }]}>{formatDate(s.date)}</Text>
        </View>

        {/* Milieu : kicker + titre */}
        <View>
          <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginBottom: 3 }]}>{kicker(s)}</Text>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]} numberOfLines={2}>
            {s.dossier_titre || s.titre || s.objet}
          </Text>
        </View>

        {/* Bas : badge résultat + total + barre divergente (écart + abstention centrée + décompte) */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <Chip
              label={adopte ? "Adopté" : "Rejeté"}
              bg={adopte ? C.adopteBg : C.rejeteBg}
              fg={adopte ? C.adopteFg : C.rejeteFg}
              radius={7}
              ph={9}
              pv={3}
            />
            {votants > 0 && (
              <Text style={[T.small, tnum, { color: C.textMuted }]}>{votantsDisp} votants</Text>
            )}
          </View>
          {votants > 0 && (
            <VoteBarDivergenteCentree pour={p} contre={c} abstention={a} active={active} ecart decompte />
          )}
        </View>
      </View>
    </Card>
  );
}

/** Indicateur de fraîcheur : « Mis à jour le … » + « En direct » (pulse) si < 48h. */
function FreshnessIndicator({ ingestedAt, reduceMotion }: { ingestedAt: string | null | undefined; reduceMotion: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const d = ingestedAt ? new Date(ingestedAt) : null;
  const valid = !!d && !isNaN(d.getTime());
  const recent = valid && Date.now() - (d as Date).getTime() < 48 * 3600 * 1000;

  useEffect(() => {
    if (!recent || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [recent, reduceMotion]);

  if (!ingestedAt || !valid) return null; // jamais de date inventée

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 9 }}>
      <Text style={[T.small, { color: C.textMuted }]}>
        Mis à jour le {formatDate(ingestedAt.slice(0, 10))}
      </Text>
      {recent && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Animated.View
            style={{
              width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent,
              opacity: reduceMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ scale: reduceMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
            }}
          />
          <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>En direct</Text>
        </View>
      )}
    </View>
  );
}

/** Carrousel horizontal swipeable des derniers grands scrutins (version signature). */
export function HeroScrutins({
  scrutins, onOpen, ingestedAt,
}: {
  scrutins: ScrutinResume[];
  onOpen: (uid: string) => void;
  ingestedAt?: string | null;
}) {
  const { width: winW } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [boxW, setBoxW] = useState(0);
  const [index, setIndex] = useState(0);
  const effW = boxW > 0 ? boxW : Math.min(winW, 560);
  const cardW = effW - SIDE * 2;
  const interval = cardW + GAP;
  const listRef = useRef<FlatList>(null);

  // Flèches visibles sur web ou écran large (le swipe suffit sur petit mobile).
  const showArrows = (Platform.OS === "web" || winW > 700) && scrutins.length > 1;

  // Navigation par flèches, avec wrap.
  const go = (dir: number) => {
    const n = scrutins.length;
    const ni = (index + dir + n) % n;
    listRef.current?.scrollToOffset({ offset: ni * interval, animated: true });
    setIndex(ni);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== boxW) setBoxW(w);
  };

  // Index courant via les éléments visibles (synchronise points + flèches).
  const onViewRef = useRef((info: { viewableItems: Array<{ index: number | null }> }) => {
    const first = info.viewableItems[0];
    if (first && first.index != null) setIndex(first.index);
  });
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 60 });

  const arrowStyle = {
    position: "absolute" as const, top: HERO_H / 2 - 17, width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong,
    alignItems: "center" as const, justifyContent: "center" as const, ...shadowCard,
  };

  return (
    <View key={winW} onLayout={onLayout}>
      <FlatList
        ref={listRef}
        data={scrutins}
        keyExtractor={(s) => s.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        snapToAlignment="start"
        disableIntervalMomentum
        extraData={index}
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfigRef.current}
        renderItem={({ item, index: i }) => (
          <HeroCard s={item} width={cardW} active={i === index} reduceMotion={reduceMotion} onPress={() => onOpen(item.uid)} />
        )}
      />

      {/* Flèches (web / large), avec wrap */}
      {showArrows && (
        <>
          <TouchableOpacity accessibilityLabel="Scrutin précédent" accessibilityRole="button" onPress={() => go(-1)} style={{ ...arrowStyle, left: 4 }}>
            <Feather name="chevron-left" size={20} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Scrutin suivant" accessibilityRole="button" onPress={() => go(1)} style={{ ...arrowStyle, right: 4 }}>
            <Feather name="chevron-right" size={20} color={C.accent} />
          </TouchableOpacity>
        </>
      )}

      {/* Pagination : l'actif s'allonge en pilule C.accent */}
      {scrutins.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 11 }}>
          {scrutins.map((_, i) => (
            <View key={i} style={{ width: i === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.accent : C.borderStrong }} />
          ))}
        </View>
      )}

      <FreshnessIndicator ingestedAt={ingestedAt} reduceMotion={reduceMotion} />
    </View>
  );
}
