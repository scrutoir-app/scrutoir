import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Animated, Easing } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, MOTION, couleurGroupe } from "../theme";
import { Button } from "../components/ui";
import { ScrutoirMark } from "../components/brand/ScrutoirMark";
import { CarteSuivi } from "../components/CarteSuivi";
import { SearchResultsList } from "../components/SearchResultsList";
import { useReduceMotion } from "../components/HeroScrutins";
import { getPartis, getCategories, getTestProximite, getVotesSuivis, getVotesPartisSuivis, getDossiersSitues } from "../api";
import { useFollows } from "../follows";
import { useJe } from "../testProximite/jeProximite";
import { nbNeuves } from "../testProximite/config";
import type { PartiResume, CategorieRef, VoteSuivi } from "../types";
import type { QuestionProximite } from "../testProximite/score";
import type { Nav } from "../nav";

// ACCUEIL v4 — refonte visuelle (mêmes actions & routes que v3). Masthead + recherche RÉELLE
// (montage stable = garde le focus) + chips de thèmes, puis, quand tu t'es situé : HÉRO
// « Continue à te situer » (→ test), DUO « Ta proximité » (mini-spectre) + « Tes accords »
// côte à côte, puis le FLUX des suivis (repli « Face à face »). Animations Animated, coupées si
// « animations réduites ». Aucune couleur en dur : tokens + couleurGroupe uniquement.

/** Barre de remplissage animée (piste + fill mesuré en px → anim fiable web, comme VoteBar…). */
function BarreFill({ pct, color, track, trackOpacity = 1, height = 8, delay = 0 }: { pct: number; color: string; track: string; trackOpacity?: number; height?: number; delay?: number }) {
  const [w, setW] = useState(0);
  const a = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) { a.setValue(1); return; }
    a.setValue(0);
    const anim = Animated.timing(a, { toValue: 1, duration: MOTION.slow, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [reduce, w, pct]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: height / 2, overflow: "hidden" }}>
      {/* Piste : couleur en TOKEN + opacité séparée (jamais de rgba en dur) ; le fill est un
          frère au-dessus, à pleine opacité. */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height, backgroundColor: track, opacity: trackOpacity }} />
      <Animated.View style={{ height, borderRadius: height / 2, backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: [0, (w * Math.max(0, Math.min(100, pct))) / 100] }) }} />
    </View>
  );
}

export function AccueilAccordsScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const je = useJe();
  const follows = useFollows();
  const reduce = useReduceMotion();
  const deputeUids = useMemo(() => follows.filter((u) => u.startsWith("PA")), [follows]);
  const partiUids = useMemo(() => follows.filter((u) => u.startsWith("PO")), [follows]);

  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);
  const [votes, setVotes] = useState<VoteSuivi[] | null>(null);
  const [accordsCount, setAccordsCount] = useState(0);

  useEffect(() => {
    getPartis().then(setPartis).catch(() => {});
    getCategories().then(setCats).catch(() => {});
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);
  useEffect(() => { if (je) getDossiersSitues(je.reponses).then((d) => setAccordsCount(d.length)).catch(() => {}); }, [je]);
  useEffect(() => {
    let alive = true;
    setVotes(null);
    Promise.all([getVotesSuivis(deputeUids, 40), getVotesPartisSuivis(partiUids, 40)])
      .then(([d, p]) => { if (alive) setVotes([...d, ...p].sort((a, b) => (b.date || "").localeCompare(a.date || ""))); })
      .catch(() => { if (alive) setVotes([]); });
    return () => { alive = false; };
  }, [follows.join(",")]);

  const todo = je ? nbNeuves(questions, je.reponses) : 0;
  const tranches = je?.nbVotes ?? 0;
  const situe = tranches > 0 || accordsCount > 0;
  const progressPct = tranches + todo > 0 ? (tranches / (tranches + todo)) * 100 : 8;
  const flux = (votes ?? []).slice(0, 4);
  const sujets = [...cats].sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0)).slice(0, 6);

  // Mini-spectre : le top 3 des groupes du test (classement DÉJÀ trié par pct dans `je`), coloré
  // via couleurGroupe. Représentation reprise de TestResultatScreen, en version compacte.
  const spectre = useMemo(() => {
    if (!je) return [] as { abrev: string; pct: number; couleur: string | null }[];
    const byAb = new Map(partis.map((p) => [p.abrev, p]));
    return je.resultat.global.slice(0, 3).map((g) => ({ abrev: g.abrev, pct: Math.round(g.pct * 100), couleur: byAb.get(g.abrev)?.couleur ?? null }));
  }, [je, partis]);

  // Entrée en fondu-montée (une valeur partagée) + flottement du filigrane du héro.
  const enter = useRef(new Animated.Value(0)).current;
  const floaty = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { enter.setValue(1); return; }
    enter.setValue(0);
    const a = Animated.timing(enter, { toValue: 1, duration: MOTION.slow, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [reduce, situe]);
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floaty, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(floaty, { toValue: 0, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduce]);
  const rise = (i = 0) => ({ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10 + i * 4, 0] }) }] });
  const floatStyle = { transform: [{ translateY: floaty.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }) }] };

  // Champ de recherche (carré ardoise + loupe blanche) — recherche réelle.
  const Champ = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11, height: 52, backgroundColor: C.surface, borderRadius: 14, paddingLeft: 8, paddingRight: 15, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}>
      <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
        <Feather name="search" size={19} color={C.onAccent} />
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Sur quoi ils ont voté ?"
        placeholderTextColor={C.textFaint}
        style={{ flex: 1, fontSize: 16, fontFamily: F.semibold, color: C.text }}
        returnKeyType="search"
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={8}><Feather name="x" size={18} color={C.textFaint} /></TouchableOpacity>
      )}
    </View>
  );

  // UN SEUL arbre : le champ de recherche reste TOUJOURS monté, à la même position dans la
  // ScrollView. Seul le contenu SOUS le champ bascule (accueil ↔ résultats). Sans ça, taper la
  // 1re lettre remplaçait tout l'arbre → le TextInput était démonté/remonté → perte du focus.
  const recherche = !!q.trim();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* 1 — Masthead (logo officiel brand/ScrutoirMark), caché en mode recherche */}
      {!recherche && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 }}>
          <ScrutoirMark size={30} />
          <Text style={[T.title, { fontFamily: F.extra, color: C.text, letterSpacing: -0.4 }]}>Scrutoir</Text>
        </View>
      )}

      {/* 2 — Recherche (position STABLE = garde le focus) + chips de thèmes (accueil seul) */}
      <View style={{ paddingHorizontal: 16, paddingTop: recherche ? 12 : 10 }}>
        {Champ}
        {!recherche && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10, paddingBottom: 2 }}>
            {sujets.map((c) => (
              <TouchableOpacity key={c.id} activeOpacity={0.7} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} style={{ backgroundColor: C.surfaceSunken, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{c.libelle}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 3a — Mode recherche : résultats sous le champ (le reste de l'accueil est masqué) */}
      {recherche && (
        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
          <SearchResultsList q={q} nav={nav} onCorriger={setQ} />
        </View>
      )}

      {/* 3 & 4 — reste de l'accueil, masqué en mode recherche */}
      {!recherche && (
        <>
          {/* HÉRO « continue à te situer » — remplace le rappel « N à trancher ». Même route que
              la file à trancher : nav.push({ name: "test", mode: "affiner" }). Simple carte
              d'action + barre de progression (pas d'aperçu du deck : ce serait un doublon). */}
          <Animated.View style={[{ marginHorizontal: 16, marginTop: 16 }, rise(0)]}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => nav.push({ name: "test", mode: "affiner" })} style={{ position: "relative", overflow: "hidden", backgroundColor: C.accent, borderRadius: RADIUS.xl, padding: 16 }}>
              <Animated.View style={[{ position: "absolute", right: -12, top: -6, opacity: 0.16 }, floatStyle]} pointerEvents="none">
                <ScrutoirMark size={140} color={C.onAccent} accent={C.onAccent} whiteSeat={false} />
              </Animated.View>
              <Text style={[T.micro, { fontFamily: F.extra, color: C.onAccent, opacity: 0.7, letterSpacing: 0.5 }]}>TON TEST DE PROXIMITÉ</Text>
              <Text style={[T.heading, { fontFamily: F.extra, color: C.onAccent, marginTop: 5, maxWidth: "76%" }]}>{situe ? "Continue à te situer" : "Commence à te situer"}</Text>
              <Text style={[T.small, { color: C.onAccent, opacity: 0.72, marginTop: 5, maxWidth: "82%" }]}>{situe ? "Reprends là où tu t'es arrêté·e. Tes réponses affinent ta proximité." : "Réponds à quelques scrutins pour découvrir de qui tu es proche."}</Text>
              <View style={{ marginTop: 14 }}>
                <BarreFill pct={progressPct} color={C.onAccent} track={C.onAccent} trackOpacity={0.2} delay={200} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 11, gap: 10 }}>
                {situe && <Text style={[T.micro, tnum, { fontFamily: F.semibold, color: C.onAccent, opacity: 0.72 }]}>{tranches} tranchés · {todo} à trancher</Text>}
                <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.onAccent, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text style={[T.small, { fontFamily: F.extra, color: C.accent }]}>Reprendre</Text>
                  <Feather name="arrow-right" size={15} color={C.accent} />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* DUO — Ta proximité (mini-spectre) + Tes accords, côte à côte (hauteur égale) */}
          {situe && (
            <Animated.View style={[{ flexDirection: "row", gap: 12, marginHorizontal: 16, marginTop: 22 }, rise(1)]}>
              {/* Ta proximité → testResultat */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => nav.push({ name: "testResultat" })} style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="compass-outline" size={20} color={C.accent} />
                  <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Ta proximité</Text>
                </View>
                <Text style={[T.micro, { color: C.textMuted, marginTop: 3 }]}>Un spectre, pas un parti</Text>
                <View style={{ marginTop: 11, gap: 7 }}>
                  {spectre.length ? spectre.map((g, i) => (
                    <View key={g.abrev} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: couleurGroupe(g.couleur) }} />
                      <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{g.abrev}</Text>
                      <View style={{ flex: 1 }}>
                        <BarreFill pct={g.pct} color={couleurGroupe(g.couleur)} track={C.surfaceSunken} height={7} delay={300 + i * 90} />
                      </View>
                      <Text style={[T.micro, tnum, { fontFamily: F.extra, color: C.text, width: 32, textAlign: "right" }]}>{g.pct}%</Text>
                    </View>
                  )) : <Text style={[T.micro, { color: C.textFaint }]}>Réponds au test pour voir ton spectre.</Text>}
                </View>
                <Text style={[T.small, { fontFamily: F.extra, color: C.accent, marginTop: 12 }]}>Voir le spectre ›</Text>
              </TouchableOpacity>

              {/* Tes accords → accords */}
              <TouchableOpacity activeOpacity={0.8} onPress={() => nav.push({ name: "accords" })} style={{ flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color={C.accent} />
                  <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Tes accords</Text>
                </View>
                <Text style={[T.micro, { color: C.textMuted, marginTop: 3 }]}>Qui a voté comme toi, texte par texte</Text>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                  <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.text, marginTop: 14 }]}>
                    {accordsCount}<Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}> texte{accordsCount > 1 ? "s" : ""} situé{accordsCount > 1 ? "s" : ""}</Text>
                  </Text>
                </View>
                <Text style={[T.small, { fontFamily: F.extra, color: C.accent, marginTop: 12 }]}>Voir ›</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* CTA autonome, discret : trouver son député (bouton contour, cf. écran résultat).
              Remonté AU-DESSUS du flux « Depuis ta dernière visite » (accès plus direct). */}
          <Animated.View style={rise(2)}>
            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <Button
                label="Trouver ton député"
                onPress={() => nav.push({ name: "monDepute" })}
                variant="outline"
                size="sm"
                fullWidth
                iconLeft={<Feather name="user" size={17} color={C.accent} />}
              />
            </View>
          </Animated.View>

          {/* FLUX des suivis (sous le CTA) — ou repli « Face à face » quand rien de neuf */}
          {votes == null ? (
            <ActivityIndicator color={C.textMuted} style={{ marginTop: 24 }} />
          ) : flux.length > 0 ? (
            <Animated.View style={rise(3)}>
              <View style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 2 }}>
                <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Depuis ta dernière visite</Text>
                <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>Les votes récents de tes suivis — comme toi, ou proximité globale.</Text>
              </View>
              <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 9 }}>
                {flux.map((v) => <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />)}
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={rise(3)}>
              <View style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 2 }}>
                <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{follows.length ? "Tu es à jour sur tes suivis" : "Suis un élu ou un groupe"}</Text>
                <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>{follows.length ? "Rien de neuf côté suivis. En attendant, confronte deux élus." : "Pour voir leurs votes ici. En attendant, confronte deux élus."}</Text>
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "confrontation" })} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 9, backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong, borderRadius: 14, padding: 13, ...shadowCard }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.pour, opacity: 0.9 }} />
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.contre, opacity: 0.9, marginLeft: -10, borderWidth: 2, borderColor: C.surface }} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <MaterialCommunityIcons name="sword-cross" size={15} color={C.textMuted} />
                    <Text style={[T.small, { fontFamily: F.extra, color: C.text }]}>Face à face</Text>
                  </View>
                  <Text style={[T.micro, { color: C.textMuted, marginTop: 2 }]}>Confronte deux élus, leurs votes côte à côte.</Text>
                </View>
                <Text style={[T.small, { fontFamily: F.extra, color: C.accent }]}>Lancer ›</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </>
      )}
    </ScrollView>
  );
}
