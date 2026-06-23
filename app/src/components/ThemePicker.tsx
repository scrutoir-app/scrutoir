import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, ScrollView, Animated, Platform, AccessibilityInfo,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, RADIUS, F, T, tnum, shadowCard } from "../theme";
import { catUI } from "../categoryUI";
import { ScrutoirMark } from "./ScrutoirMark";
import type { CategorieRef } from "../types";

const THUMB = 46; // taille tappable mini (≥ 44px)
const GAP = 10;
const PITCH = THUMB + GAP; // pas de défilement / snap
const ARROW = 30;
const SIDE_PAD = 38; // marge latérale pour ne pas masquer les minis sous les flèches

/** Préférence reduce-motion, suivie en direct. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduce(v); });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduce;
}

/** Bouton miniature d'un thème (picto neutre). Survol (web) / tap = prévisualise la vedette. */
function Thumb({ c, active, onSelect }: { c: CategorieRef; active: boolean; onSelect: () => void }) {
  const ui = catUI(c.id);
  return (
    <Pressable
      onPress={onSelect}
      onHoverIn={onSelect}
      accessibilityRole="button"
      accessibilityLabel={c.libelle}
      style={{
        width: THUMB, height: THUMB, borderRadius: RADIUS.md,
        backgroundColor: active ? C.accent : C.surface,
        borderWidth: 0.5, borderColor: active ? C.accent : C.border,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <MaterialCommunityIcons name={ui.icon as any} size={22} color={active ? "#FFFFFF" : C.textMuted} />
    </Pressable>
  );
}

/** Flèche ronde de pagination (desktop / large écran). */
function Arrow({
  dir, disabled, onPress,
}: { dir: "left" | "right"; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={dir === "left" ? "Miniatures précédentes" : "Miniatures suivantes"}
      style={{
        width: ARROW, height: ARROW, borderRadius: ARROW / 2,
        backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong,
        alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.35 : 1, ...shadowCard,
      }}
    >
      <MaterialCommunityIcons name={dir === "left" ? "chevron-left" : "chevron-right"} size={22} color={C.accent} />
    </Pressable>
  );
}

/**
 * Sélecteur de thèmes : une VEDETTE (carte haute) pilotée par une PELLICULE de
 * miniatures paginable. Neutre : la couleur n'encode jamais le thème (cf. theme.ts),
 * on n'utilise que le glyphe `catUI.icon` colorisé en neutre.
 */
export function ThemePicker({ cats, onOpen }: { cats: CategorieRef[]; onOpen: (c: CategorieRef) => void }) {
  const [index, setIndex] = useState(0);
  const reduce = useReduceMotion();
  const { width: screenW } = useWindowDimensions();
  const showArrows = Platform.OS === "web" || screenW > 700;

  // Suivi du défilement pour griser les flèches en bout de course.
  // Mesures fiabilisées : on lit directement le nœud scrollable (web) + les métriques
  // portées par l'événement onScroll, plutôt que de dépendre du seul onContentSizeChange.
  const scrollRef = useRef<ScrollView>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [viewW, setViewW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [cardW, setCardW] = useState(0); // largeur de la vedette → dimensionne le filigrane
  const canLeft = offsetX > 2;
  const canRight = offsetX < contentW - viewW - 2;

  const measure = useCallback(() => {
    const dom = (scrollRef.current as any)?.getScrollableNode?.();
    if (dom && typeof dom.scrollWidth === "number") {
      setContentW(dom.scrollWidth);
      setViewW(dom.clientWidth);
      setOffsetX(dom.scrollLeft);
    }
  }, []);

  // Mesure initiale (web) une fois le contenu monté, puis si la liste change.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const id = setTimeout(measure, 0);
    return () => clearTimeout(id);
  }, [measure, cats.length]);

  // Micro-anim de la pastille au changement de vedette (sautée si reduce-motion).
  // useNativeDriver désactivé sur web (module natif absent → warning).
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { scale.setValue(1); return; }
    scale.setValue(0.9);
    Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", friction: 6, tension: 120 }).start();
  }, [index, reduce, scale]);

  // Ordre neutre : par nombre de scrutins décroissant (reflète l'activité de l'Assemblée
  // sur chaque thème, sans encoder de jugement). Bascule alphabétique possible en une ligne.
  const sortedCats = useMemo(
    () => [...cats].sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0)),
    [cats]
  );

  if (!sortedCats.length) return null;
  const featured = sortedCats[Math.min(index, sortedCats.length - 1)];
  const ui = catUI(featured.id);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    setOffsetX(contentOffset.x);
    if (contentSize?.width) setContentW(contentSize.width);
    if (layoutMeasurement?.width) setViewW(layoutMeasurement.width);
  };

  const paginate = (dir: -1 | 1) => {
    const page = Math.max(PITCH, viewW * 0.7);
    const max = Math.max(0, contentW - viewW);
    const next = Math.min(max, Math.max(0, offsetX + dir * page));
    const sv = scrollRef.current as any;
    // Web : le scrollTo du scroller RNW est un no-op ici → on pose scrollLeft (qui marche),
    // et on délègue le lissage au CSS scroll-behavior (instantané si reduce-motion).
    const dom = sv?.getScrollableNode?.();
    if (dom && typeof dom.scrollLeft === "number") {
      if (dom.style) dom.style.scrollBehavior = reduce ? "auto" : "smooth";
      dom.scrollLeft = next;
    } else {
      sv?.scrollTo?.({ x: next, animated: !reduce }); // natif
    }
  };

  return (
    <View>
      {/* VEDETTE */}
      <Pressable
        onPress={() => onOpen(featured)}
        onLayout={(e) => setCardW(e.nativeEvent.layout.width)}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir le thème ${featured.libelle}`}
        style={{
          backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border,
          borderRadius: RADIUS.lg, overflow: "hidden", padding: 20, alignItems: "center", ...shadowCard,
        }}
      >
        {/* Filigrane logo — grand hémicycle centré qui occupe toute la vignette, très léger. */}
        {cardW > 0 && (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", opacity: 0.025, pointerEvents: "none" }}>
            <ScrutoirMark size={cardW * 0.72} color={C.text} accent={C.text} />
          </View>
        )}

        <Animated.View
          style={{
            width: 62, height: 62, borderRadius: 18, backgroundColor: C.surfaceSunken,
            alignItems: "center", justifyContent: "center", transform: [{ scale }],
          }}
        >
          <MaterialCommunityIcons name={ui.icon as any} size={32} color={C.accent} />
        </Animated.View>

        <Text style={[T.title, { color: C.text, marginTop: 14, textAlign: "center" }]}>
          {ui.court ?? featured.libelle}
        </Text>

        {featured.nb_scrutins != null && (
          <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, marginTop: 4, textAlign: "center" }]}>
            {featured.nb_scrutins} scrutins
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.accent }]}>Ouvrir</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={C.accent} />
        </View>
      </Pressable>

      {/* PELLICULE */}
      <View style={{ marginTop: 12, position: "relative", justifyContent: "center" }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={PITCH}
          snapToAlignment="start"
          decelerationRate="fast"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
          onContentSizeChange={(w) => setContentW(w)}
          contentContainerStyle={{ paddingHorizontal: showArrows ? SIDE_PAD : 2, gap: GAP, paddingVertical: 2 }}
        >
          {sortedCats.map((c, i) => (
            <Thumb key={c.id} c={c} active={i === index} onSelect={() => setIndex(i)} />
          ))}
        </ScrollView>

        {showArrows && (
          <>
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "box-none" }}>
              <Arrow dir="left" disabled={!canLeft} onPress={() => paginate(-1)} />
            </View>
            <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center", pointerEvents: "box-none" }}>
              <Arrow dir="right" disabled={!canRight} onPress={() => paginate(1)} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}
