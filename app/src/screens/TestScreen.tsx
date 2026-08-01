import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Animated, PanResponder, useWindowDimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import { catUI } from "../categoryUI";
import { useReduceMotion } from "../components/HeroScrutins";
import type { CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { chargerTest, fusionnerReponses } from "../testProximite/storage";
import { questionsNeuves, N_AFFINER } from "../testProximite/config";
import { track } from "../analytics";

// TEST DE PROXIMITÉ « au swipe » — remplace le question-par-question. MÊME test : mêmes questions
// (getTestProximite + même tirage par mode), MÊME stockage (fusionnerReponses), MÊME résultat
// (nav → testResultat, spectre). Trois règles produit : (1) ANTICIPATION — aucun résultat pendant
// le deck, juste un décompte neutre ; (2) le résultat est un SPECTRE (écran testResultat) ; (3) on
// suit depuis le résultat. Gestes : Animated + PanResponder du cœur RN (aucune dépendance). Les 3
// boutons (Contre / Sans avis / Pour) + Annuler font tout ce que fait le swipe (voie clavier/desktop).

const N_COMPLET = 12;
const N_THEME = 10;

function melange<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tirage : mode thème = jusqu'à 10 du thème ; mode complet = ~12 réparties sur les
 *  thèmes ET les familles de clivage (round-robin + variation de l'axe), sans doublon. */
function tirer(all: QuestionProximite[], mode: "theme" | "complet", theme?: string): QuestionProximite[] {
  if (mode === "theme") return melange(all.filter((q) => q.theme === theme)).slice(0, N_THEME);
  const byTheme: Record<string, QuestionProximite[]> = {};
  for (const q of all) (byTheme[q.theme] ||= []).push(q);
  Object.values(byTheme).forEach((l) => l.sort(() => Math.random() - 0.5));
  const themes = melange(Object.keys(byTheme));
  const picked: QuestionProximite[] = [];
  const seenFam = new Set<string>();
  while (picked.length < N_COMPLET && themes.some((t) => byTheme[t].length)) {
    for (const t of themes) {
      if (picked.length >= N_COMPLET) break;
      const pool = byTheme[t];
      if (!pool.length) continue;
      let i = pool.findIndex((q) => !seenFam.has(q.famille_clivage ?? ""));
      if (i < 0) i = 0;
      const [q] = pool.splice(i, 1);
      picked.push(q);
      seenFam.add(q.famille_clivage ?? "");
    }
  }
  return picked;
}

export function TestScreen({ mode, theme, nav }: { mode: "theme" | "complet" | "affiner"; theme?: string; themeLibelle?: string; nav: Nav }) {
  const [all, setAll] = useState<QuestionProximite[] | null>(null);
  const dejaFait = useMemo(() => (mode === "affiner" ? chargerTest() : null), [mode]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [idx, setIdx] = useState(0);
  const [reponses, setReponses] = useState<Record<number, Reponse>>({});
  const [history, setHistory] = useState<number[]>([]);
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();

  const testKey = mode === "affiner" ? "affiner" : mode === "theme" ? theme ?? "theme" : "complet";
  useEffect(() => { track("test_start", testKey); }, []);
  useEffect(() => {
    Promise.all([getTestProximite(), getPartis(), getCategories()]).then(([qs, , cs]) => { setCats(cs); setAll(qs); });
  }, []);

  const questions = useMemo(() => {
    if (!all) return [];
    if (mode === "affiner") return questionsNeuves(all, dejaFait?.reponses ?? {}, dejaFait?.poids, theme).slice(0, N_AFFINER);
    return tirer(all, mode, theme);
  }, [all, mode, theme, dejaFait]);
  const total = questions.length;
  const libelleTheme = (id: string) => cats.find((c) => c.id === id)?.libelle ?? (catUI(id) as { court?: string }).court ?? id;

  // Position de la carte du dessus (Animated) — les gestes l'écrivent, on la remet à 0 par carte.
  const pan = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false); // verrou : ignore un 2e choix tant que la carte s'envole (anti double-réponse)
  const seuil = Math.max(90, width * 0.24);
  const horsChamp = width * 1.35;

  const enregistrer = (r: Reponse) => {
    const q = questions[idx];
    if (!q) return;
    const suite = { ...reponses, [q.id]: r };
    setReponses(suite);
    setHistory((h) => [...h, q.id]);
    pan.setValue({ x: 0, y: 0 });
    busy.current = false;
    if (idx + 1 >= total) {
      track("test_done", testKey);
      fusionnerReponses(suite); // MÊME stockage que le test question-par-question
      nav.push({ name: "testResultat" });
    } else {
      setIdx(idx + 1);
    }
  };

  const envol = (r: Reponse, to: { x: number; y: number }) => {
    if (reduce) return enregistrer(r);
    Animated.timing(pan, { toValue: to, duration: 260, useNativeDriver: false }).start(() => enregistrer(r));
  };
  const choisir = (r: Reponse) => {
    if (busy.current) return;
    busy.current = true;
    if (r === "pour") envol("pour", { x: horsChamp, y: 0 });
    else if (r === "contre") envol("contre", { x: -horsChamp, y: 0 });
    else envol("sans_avis", { x: 0, y: -horsChamp });
  };
  const annuler = () => {
    if (!history.length) return;
    const id = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setReponses((p) => { const n = { ...p }; delete n[id]; return n; });
    pan.setValue({ x: 0, y: 0 });
    setIdx((i) => Math.max(0, i - 1));
  };

  const responder = useMemo(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (g.dx > seuil) choisir("pour");
        else if (g.dx < -seuil) choisir("contre");
        else Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    }),
  [idx, reponses, history, total, reduce, seuil]);

  if (!all) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  if (!total)
    return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text style={{ textAlign: "center", color: C.textMuted }}>Aucune question disponible.</Text></View>;

  const q = questions[idx];
  const suivante = questions[idx + 1];
  const reste = total - idx;

  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-11deg", "0deg", "11deg"] });
  const opPour = pan.x.interpolate({ inputRange: [0, seuil], outputRange: [0, 1], extrapolate: "clamp" });
  const opContre = pan.x.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" });

  const carte = (question: QuestionProximite, dessus: boolean) => {
    const ui = catUI(question.theme);
    return (
      <Animated.View
        {...(dessus ? responder.panHandlers : {})}
        style={{
          position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
          backgroundColor: C.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: C.border, padding: 20,
          ...shadowCard,
          ...(dessus
            ? { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] as any }
            : { transform: [{ scale: 0.955 }, { translateY: 12 }], opacity: 0.9 }),
        }}
      >
        {dessus && (
          <>
            <Animated.View pointerEvents="none" style={{ position: "absolute", top: 20, right: 18, opacity: opPour, borderWidth: 2.5, borderColor: C.pour, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: "12deg" }] }}>
              <Text style={{ fontFamily: F.extra, color: C.pour, fontSize: 16, letterSpacing: 1 }}>POUR</Text>
            </Animated.View>
            <Animated.View pointerEvents="none" style={{ position: "absolute", top: 20, left: 18, opacity: opContre, borderWidth: 2.5, borderColor: C.contre, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, transform: [{ rotate: "-12deg" }] }}>
              <Text style={{ fontFamily: F.extra, color: C.contre, fontSize: 16, letterSpacing: 1 }}>CONTRE</Text>
            </Animated.View>
          </>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: ui.bg, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
          <MaterialCommunityIcons name={ui.icon as any} size={14} color={ui.fg} />
          <Text style={[T.micro, { fontFamily: F.bold, color: ui.fg }]}>{libelleTheme(question.theme)}</Text>
        </View>
        <Text style={[T.heading, { fontFamily: F.extra, color: C.text, fontSize: 20, lineHeight: 27, marginTop: 16 }]}>{question.these}</Text>
        <Text style={[T.micro, { color: C.textFaint, marginTop: "auto" }]}>Glisse ← Contre · Pour → · ou utilise les boutons</Text>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
      {/* Teaser d'ANTICIPATION — aucun résultat en direct, juste un décompte neutre */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 11, marginBottom: 14 }}>
        <MaterialCommunityIcons name="compass-outline" size={18} color={C.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Ton spectre · révélé dans {reste} carte{reste > 1 ? "s" : ""}</Text>
          <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>À la fin, pas de verdict carte par carte.</Text>
        </View>
        <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>{idx + 1}/{total}</Text>
      </View>

      {/* Deck */}
      <View style={{ flex: 1 }}>
        {suivante && carte(suivante, false)}
        {carte(q, true)}
      </View>

      {/* Boutons — Contre / Sans avis / Pour au MÊME niveau (voie clavier/desktop) */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <BoutonChoix icon="x" label="Contre" couleur={C.contre} onPress={() => choisir("contre")} />
        <BoutonChoix icon="minus" label="Sans avis" couleur={C.textMuted} onPress={() => choisir("sans_avis")} />
        <BoutonChoix icon="check" label="Pour" couleur={C.pour} onPress={() => choisir("pour")} />
      </View>
      <TouchableOpacity
        onPress={annuler}
        disabled={!history.length}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", marginTop: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: C.border, opacity: history.length ? 1 : 0.4 }}
      >
        <Feather name="rotate-ccw" size={13} color={C.textMuted} />
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>Annuler la dernière</Text>
      </TouchableOpacity>
      <Text style={[T.micro, { color: C.textFaint, textAlign: "center", marginTop: 10, lineHeight: 16 }]}>
        Ton avis reste privé sur cet appareil et sert à recalculer ta proximité. Rien n'est envoyé.
      </Text>
    </View>
  );
}

function BoutonChoix({ icon, label, couleur, onPress }: { icon: any; label: string; couleur: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.border, ...shadowCard }}
    >
      <Feather name={icon} size={22} color={couleur} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}
