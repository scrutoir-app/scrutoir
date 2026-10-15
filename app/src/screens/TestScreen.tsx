import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, Animated, PanResponder, ScrollView, Linking, Platform, useWindowDimensions } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import { catUI } from "../categoryUI";
import { scrutinSourceUrl } from "../config";
import { useReduceMotion } from "../components/HeroScrutins";
import type { CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { chargerTest, fusionnerReponses } from "../testProximite/storage";
import { questionsNeuves, N_AFFINER } from "../testProximite/config";
import { libelleProgression, libelleScrutin, intituleOfficiel, directionGlisse, decisionGeste, reponseDeTouche } from "../testProximite/carte";
import { track } from "../analytics";

// TEST DE PROXIMITÉ « au swipe ». MÊME test que le question-par-question d'origine : mêmes
// questions (getTestProximite + même tirage par mode), MÊME stockage (fusionnerReponses), MÊME
// résultat (nav → testResultat, spectre). Maquette validée le 15/10/2026 :
// - la carte montre le résumé (« En clair », `these`) ET l'intitulé officiel de l'AN, avec le
//   n° et la date du scrutin. JAMAIS le résultat du vote avant la réponse ;
// - Sans avis à égalité : geste ↑, même étiquette pendant le glissé, même poids de bouton ;
// - progression neutre « Carte 1 sur 8 » (remplace « révélé dans N cartes ») ;
// - sans geste : les 3 boutons, et le clavier sur le web (← Contre, ↑ Sans avis, → Pour).
// Gestes : Animated + PanResponder du cœur RN (aucune dépendance).

const N_COMPLET = 12;
const N_THEME = 10;
const PAD_CARTE = 18;
const H_INDICES = 17; // ligne « ← Contre · ↑ Sans avis · Pour → » (T.small)

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
  // Direction du glissé en cours (ou de l'envol après un bouton) : pilote l'étiquette de la carte.
  const [dir, setDir] = useState<Reponse | null>(null);
  const dirRef = useRef<Reponse | null>(null);
  // Écran très bas : hauteur minimale demandée par la carte du dessus (l'écran défile alors).
  const [besoin, setBesoin] = useState(0);
  useEffect(() => { setBesoin(0); }, [idx]);
  const { width, height } = useWindowDimensions();
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

  // Position de la carte du dessus (Animated) : les gestes l'écrivent, on la remet à 0 par carte.
  const pan = useRef(new Animated.ValueXY()).current;
  const busy = useRef(false); // verrou : ignore un 2e choix tant que la carte s'envole (anti double-réponse)
  // Fin du dernier glissé : un glissé parti du lien source ne doit pas l'ouvrir au lâcher (le
  // navigateur émet quand même un clic sur le lien).
  const finGlisse = useRef(0);
  const glisseRecent = () => Date.now() - finGlisse.current < 400;
  // Même seuil sur les deux axes : Sans avis (↑) demande le même effort que Pour / Contre.
  const seuil = Math.max(90, width * 0.24);

  const enregistrer = (r: Reponse) => {
    const q = questions[idx];
    if (!q) return;
    const suite = { ...reponses, [q.id]: r };
    setReponses(suite);
    setHistory((h) => [...h, q.id]);
    pan.setValue({ x: 0, y: 0 });
    dirRef.current = null;
    setDir(null);
    busy.current = false;
    if (idx + 1 >= total) {
      track("test_done", testKey);
      fusionnerReponses(suite); // MÊME stockage que le test question-par-question
      nav.push({ name: "testResultat" });
    } else {
      setIdx(idx + 1);
    }
  };

  const envol = (r: Reponse) => {
    if (reduce) return enregistrer(r);
    const to = r === "pour" ? { x: width * 1.35, y: 0 } : r === "contre" ? { x: -width * 1.35, y: 0 } : { x: 0, y: -height };
    Animated.timing(pan, { toValue: to, duration: 260, useNativeDriver: false }).start(() => enregistrer(r));
  };
  const choisir = (r: Reponse) => {
    if (busy.current) return;
    busy.current = true;
    dirRef.current = r;
    setDir(r);
    envol(r);
  };
  const annuler = () => {
    if (!history.length || busy.current) return;
    const id = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setReponses((p) => { const n = { ...p }; delete n[id]; return n; });
    pan.setValue({ x: 0, y: 0 });
    dirRef.current = null;
    setDir(null);
    setIdx((i) => Math.max(0, i - 1));
  };

  // Le PanResponder et l'écouteur clavier sont créés une fois : ils appellent toujours la
  // dernière version des fonctions via ces refs.
  const choisirRef = useRef(choisir);
  choisirRef.current = choisir;
  const seuilRef = useRef(seuil);
  seuilRef.current = seuil;
  const majDir = (d: Reponse | null) => {
    if (d === dirRef.current) return;
    dirRef.current = d;
    setDir(d);
  };

  const responder = useRef(
    PanResponder.create({
      // Capture au-delà de quelques pixels : un glissé qui part du lien source reste un geste,
      // un simple appui sur le lien l'ouvre.
      onMoveShouldSetPanResponderCapture: (_e, g) => !busy.current && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8),
      onPanResponderMove: (_e, g) => {
        finGlisse.current = Date.now();
        pan.setValue({ x: g.dx, y: g.dy });
        majDir(directionGlisse(g.dx, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        finGlisse.current = Date.now();
        const r = decisionGeste(g.dx, g.dy, seuilRef.current);
        if (r) { choisirRef.current(r); return; }
        majDir(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        majDir(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  // Clavier (web) : ← Contre, ↑ Sans avis, → Pour.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const cible = e.target as HTMLElement | null;
      if (cible && (cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable)) return;
      const r = reponseDeTouche(e.key);
      if (!r) return;
      e.preventDefault();
      choisirRef.current(r);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!all) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  if (!total)
    return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text style={{ textAlign: "center", color: C.textMuted }}>Aucune question disponible.</Text></View>;

  const q = questions[idx];
  const suivante = questions[idx + 1];

  const rotate = pan.x.interpolate({ inputRange: [-width, 0, width], outputRange: ["-11deg", "0deg", "11deg"] });
  const opacites: Record<Reponse, Animated.AnimatedInterpolation<number>> = {
    pour: pan.x.interpolate({ inputRange: [0, seuil], outputRange: [0, 1], extrapolate: "clamp" }),
    contre: pan.x.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" }),
    sans_avis: pan.y.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" }),
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
      {/* Progression neutre : où on en est, rien sur le résultat. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{libelleProgression(idx, total)}</Text>
        <Text style={[T.micro, { color: C.textFaint }]} numberOfLines={1}>Ton spectre s'affiche à la fin</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Progression du test"
        accessibilityValue={{ min: 0, max: total, now: idx + 1 }}
        style={{ marginTop: 6, flexDirection: "row", gap: 3 }}
      >
        {questions.map((qq, k) => (
          <View key={qq.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k <= idx ? C.accent : C.borderStrong }} />
        ))}
      </View>

      {/* Deck : la carte suivante dessous, la carte courante dessus (seule à recevoir le geste). */}
      <View style={{ flex: 1, marginTop: 12, minHeight: besoin || undefined }}>
        {suivante && <CarteQuestion key={suivante.id} question={suivante} dessus={false} libelleTheme={libelleTheme} />}
        <CarteQuestion
          key={q.id}
          question={q}
          dessus
          libelleTheme={libelleTheme}
          panHandlers={responder.panHandlers}
          transform={[{ translateX: pan.x }, { translateY: pan.y }, { rotate }]}
          dir={dir}
          opacites={opacites}
          onBesoin={setBesoin}
          glisseRecent={glisseRecent}
        />
      </View>

      {/* Boutons : Contre / Sans avis / Pour, même taille et même poids (voie sans geste). */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <BoutonChoix icon="x" label="Contre" couleur={C.contre} onPress={() => choisir("contre")} />
        <BoutonChoix icon="minus" label="Sans avis" couleur={C.accent} onPress={() => choisir("sans_avis")} />
        <BoutonChoix icon="check" label="Pour" couleur={C.pour} onPress={() => choisir("pour")} />
      </View>
      <TouchableOpacity
        onPress={annuler}
        disabled={!history.length}
        accessibilityRole="button"
        accessibilityState={{ disabled: !history.length }}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "center", marginTop: 8, minHeight: 44, paddingHorizontal: 14, opacity: history.length ? 1 : 0.6 }}
      >
        <Feather name="rotate-ccw" size={14} color={C.textFaint} />
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textFaint }]}>Annuler la dernière</Text>
      </TouchableOpacity>
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, textAlign: "center", lineHeight: 15, marginBottom: 10 }]}>
        Ton avis reste sur cet appareil. Rien n'est envoyé.
      </Text>
    </ScrollView>
  );
}

/** Lien vers la page du scrutin sur le site de l'Assemblée (n° et date en clair). Inerte
 *  (`actif` faux) sur la carte du dessous : même rendu, mais ni appui ni focus clavier. */
function LienSource({ question, actif = true, glisseRecent }: { question: QuestionProximite; actif?: boolean; glisseRecent?: () => boolean }) {
  const url = question.source_url ?? scrutinSourceUrl(question.id);
  const libelle = `${libelleScrutin(question.id, question.date)}, sur le site de l'Assemblée`;
  if (!url) return null;
  if (!actif)
    return (
      <View style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.accent }]}>{libelle}</Text>
      </View>
    );
  return (
    <TouchableOpacity
      onPress={() => { if (!glisseRecent?.()) Linking.openURL(url); }}
      accessibilityRole="link"
      accessibilityLabel={libelle}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.accent }]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

/** Étiquette visible pendant le glissé, même forme pour les trois réponses. Posée du côté
 *  qui reste à l'écran : Pour à gauche quand la carte part à droite, Contre à droite. */
function Etiquette({ label, couleur, opacity, position }: { label: string; couleur: string; opacity: Animated.AnimatedInterpolation<number>; position?: object }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ zIndex: 2, opacity, borderWidth: 2, borderColor: couleur, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: C.surface }, position && { position: "absolute" }, position]}
    >
      <Text style={[T.heading, { fontFamily: F.extra, color: couleur }]}>{label}</Text>
    </Animated.View>
  );
}

/**
 * Une carte du deck. Typo de la maquette par défaut ; si le texte ne tient pas (petit écran,
 * intitulé AN très long), elle passe en typo compacte, et si ça ne suffit pas, elle demande sa
 * hauteur et l'écran défile. Rien n'est jamais coupé : résumé, intitulé, n°, date, lien source.
 */
function CarteQuestion({
  question,
  dessus,
  libelleTheme,
  panHandlers,
  transform,
  dir,
  opacites,
  onBesoin,
  glisseRecent,
}: {
  question: QuestionProximite;
  dessus: boolean;
  libelleTheme: (id: string) => string;
  panHandlers?: object;
  transform?: object[];
  dir?: Reponse | null;
  opacites?: Record<Reponse, Animated.AnimatedInterpolation<number>>;
  onBesoin?: (hauteur: number) => void;
  glisseRecent?: () => boolean;
}) {
  const ui = catUI(question.theme);
  const these = question.these?.trim() || null;
  const intitule = intituleOfficiel(question.titre);

  // 0 = typo de la maquette, 1 = compacte.
  const [niveau, setNiveau] = useState<0 | 1>(0);
  const niveauRef = useRef(niveau);
  niveauRef.current = niveau;
  const compact = niveau > 0;
  // Mesures (hauteur + niveau de typo auquel elles ont été prises) : on ne décide que sur des
  // mesures prises au niveau courant, quel que soit l'ordre d'arrivée des onLayout.
  const carte = useRef({ h: 0, l: 0 });
  const corps = useRef({ h: 0, n: -1 });
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);
  // Devenue la carte du dessus : elle peut maintenant demander sa hauteur.
  useEffect(() => { if (dessus) planifier(); }, [dessus]);

  const ajuster = () => {
    const n = niveauRef.current;
    if (!carte.current.h || corps.current.n !== n) return;
    const dispo = carte.current.h - PAD_CARTE * 2 - H_INDICES - 12;
    if (corps.current.h <= dispo + 1) return;
    if (n === 0) { setNiveau(1); return; }
    // Écran très bas : même compacte, la carte ne tient pas. Elle demande sa hauteur (bordure
    // comprise) et l'écran défile, plutôt que de couper l'intitulé ou le lien source.
    onBesoin?.(corps.current.h + PAD_CARTE * 2 + H_INDICES + 12 + 2);
  };
  // Vérification différée d'un tick : les onLayout d'une même passe sont tous arrivés.
  const planifier = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(ajuster, 0);
  };

  return (
    <Animated.View
      {...(dessus ? panHandlers : {})}
      onLayout={(e) => {
        const { width: l, height: h } = e.nativeEvent.layout;
        const largeurChangee = carte.current.l > 0 && Math.abs(l - carte.current.l) > 1;
        carte.current = { h, l };
        // Largeur changée (rotation, fenêtre redimensionnée) : on repart de la typo pleine, le
        // corps se remesure alors de lui-même. Sinon (hauteur seule) on revérifie au niveau courant.
        if (largeurChangee && niveauRef.current > 0) setNiveau(0);
        else planifier();
      }}
      style={[
        {
          position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden",
          backgroundColor: C.surface, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: C.border, padding: PAD_CARTE,
          ...shadowCard,
        },
        dessus
          ? ({ transform, userSelect: "none", touchAction: "none", cursor: "grab" } as any)
          : { transform: [{ scale: 0.955 }, { translateY: 12 }], opacity: 0.9 },
      ]}
    >
      <View
        onLayout={(e) => { corps.current = { h: e.nativeEvent.layout.height, n: niveauRef.current }; planifier(); }}
        accessibilityElementsHidden={!dessus}
        importantForAccessibility={dessus ? "auto" : "no-hide-descendants"}
      >
        <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: ui.bg, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
          <MaterialCommunityIcons name={ui.icon as any} size={14} color={ui.fg} />
          <Text style={[T.micro, { fontFamily: F.bold, color: ui.fg }]}>{libelleTheme(question.theme)}</Text>
        </View>

        {these && (
          <>
            <Text style={[T.micro, { color: C.textFaint, marginTop: compact ? 10 : 14 }]}>En clair</Text>
            <Text accessibilityRole="header" style={[compact ? T.heading : T.title, { fontFamily: F.extra, color: C.text, marginTop: 2 }]}>{these}</Text>
          </>
        )}

        {intitule && (
          <>
            {these && <View style={{ height: 1, backgroundColor: C.border, marginTop: compact ? 12 : 16 }} />}
            <Text style={[T.micro, { color: C.textFaint, marginTop: these ? 12 : compact ? 10 : 14 }]}>Intitulé officiel de l'Assemblée</Text>
            <Text style={[compact ? T.small : T.body, { color: C.accent, marginTop: 3 }]}>{intitule}</Text>
          </>
        )}

        <LienSource question={question} actif={dessus} glisseRecent={glisseRecent} />
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.textMuted }]}>← Contre</Text>
        <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.textMuted, textAlign: "center" }]}>↑ Sans avis</Text>
        <Text style={[T.small, { flex: 1, fontFamily: F.semibold, color: C.textMuted, textAlign: "right" }]}>Pour →</Text>
      </View>

      {dessus && opacites && dir === "pour" && (
        <Etiquette label="Pour" couleur={C.pour} opacity={opacites.pour} position={{ top: 18, left: 16, transform: [{ rotate: "-8deg" }] }} />
      )}
      {dessus && opacites && dir === "contre" && (
        <Etiquette label="Contre" couleur={C.contre} opacity={opacites.contre} position={{ top: 18, right: 16, transform: [{ rotate: "8deg" }] }} />
      )}
      {dessus && opacites && dir === "sans_avis" && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: PAD_CARTE + H_INDICES + 12, alignItems: "center" }}>
          <Etiquette label="Sans avis" couleur={C.accent} opacity={opacites.sans_avis} />
        </View>
      )}
    </Animated.View>
  );
}

function BoutonChoix({ icon, label, couleur, onPress }: { icon: any; label: string; couleur: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: C.borderStrong }}
    >
      <Feather name={icon} size={22} color={couleur} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}
