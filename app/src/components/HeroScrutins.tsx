import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, FlatList, Animated, Easing, AccessibilityInfo,
  LayoutChangeEvent, useWindowDimensions, Platform,
} from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate } from "../theme";
import { catUI } from "../categoryUI";
import { ScrutoirMark } from "./ScrutoirMark";
import type { ScrutinResume } from "../types";

const GAP = 12;
const SIDE = 18; // marge écran (alignée sur le contenu de l'accueil)
const HERO_H = 202; // hauteur fixe de la carte (carrousel uniforme + centrage des flèches)
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
function useReduceMotion(): boolean {
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
 */
function HeroCard({
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
  const barW = width - 32; // largeur du contenu (padding 16 de chaque côté)
  const segPx = (v: number) => (v / tot) * barW;

  const progress = useRef(new Animated.Value(0)).current; // 0 → 1 (barre + compteurs)
  const fade = useRef(new Animated.Value(0)).current; // filigrane
  const seen = useRef(false);
  const [disp, setDisp] = useState({ p: 0, c: 0, v: 0 });

  // Compteurs : un listener attaché pour TOUTE la vie de la carte. L'animation n'est
  // jamais stoppée → même si la slide change en cours d'anim, `progress` atteint 1 et
  // les compteurs finissent sur la vraie valeur (pas de chiffre figé intermédiaire).
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      setDisp({ p: Math.round(value * p), c: Math.round(value * c), v: Math.round(value * votants) });
    });
    return () => progress.removeListener(id);
  }, []);

  // À la PREMIÈRE apparition de la slide : on anime. reduce-motion → valeurs finales.
  useEffect(() => {
    if (!active || seen.current) return;
    seen.current = true;
    if (reduceMotion) {
      progress.setValue(1);
      fade.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: ANIM_FADE, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: ANIM_BAR, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [active]);

  const seg = (v: number, col: string) =>
    v > 0 ? (
      <Animated.View
        key={col}
        style={{ height: 8, backgroundColor: col, width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, segPx(v)] }) }}
      />
    ) : null;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={{
        width, height: HERO_H, borderRadius: RADIUS.lg, overflow: "hidden",
        backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border, ...shadowCard,
      }}
    >
      {/* Filigrane hémicycle, coin supérieur droit, fondu à l'apparition */}
      <Animated.View style={{ position: "absolute", top: -26, right: -18, opacity: fade }} pointerEvents="none">
        <ScrutoirMark size={168} color="rgba(23,26,31,0.07)" accent="rgba(60,70,84,0.13)" />
      </Animated.View>

      <View style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
        {/* Haut : chip catégorie + date */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surfaceAlt, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
            <MaterialCommunityIcons name={ui.icon as any} size={14} color={C.accent} />
            <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: C.accent }}>{ui.court ?? "Scrutin"}</Text>
          </View>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted }}>{formatDate(s.date)}</Text>
        </View>

        {/* Milieu : kicker + titre */}
        <View>
          <Text style={{ fontFamily: F.semibold, fontSize: 11.5, color: C.textMuted, marginBottom: 3 }}>{kicker(s)}</Text>
          <Text style={{ fontFamily: F.extra, fontSize: 17.5, lineHeight: 22.5, color: C.text, letterSpacing: -0.3 }} numberOfLines={2}>
            {s.dossier_titre || s.titre || s.objet}
          </Text>
        </View>

        {/* Bas : badge résultat + méta + barre */}
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, backgroundColor: adopte ? C.adopteBg : C.rejeteBg }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: adopte ? C.adopteFg : C.rejeteFg }}>{adopte ? "Adopté" : "Rejeté"}</Text>
            </View>
            {votants > 0 && (
              <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted, fontVariant: ["tabular-nums"] }}>
                {disp.p} pour · {disp.c} contre · {disp.v} votants
              </Text>
            )}
          </View>
          {votants > 0 && (
            <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceAlt }}>
              {seg(p, C.pour)}
              {seg(c, C.contre)}
              {seg(a, C.abstention)}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
      <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted }}>
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
          <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.accent, letterSpacing: 0.2 }}>En direct</Text>
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
