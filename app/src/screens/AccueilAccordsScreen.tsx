import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { ScrutoirMark } from "../components/ScrutoirMark";
import { CarteSuivi } from "../components/CarteSuivi";
import { SearchResultsList } from "../components/SearchResultsList";
import { getPartis, getCategories, getTestProximite, getVotesSuivis, getVotesPartisSuivis, getDossiersSitues } from "../api";
import { useFollows } from "../follows";
import { useJe } from "../testProximite/jeProximite";
import { nbNeuves } from "../testProximite/config";
import type { PartiResume, CategorieRef, VoteSuivi } from "../types";
import type { QuestionProximite } from "../testProximite/score";
import type { Nav } from "../nav";

// ACCUEIL v3 (DONNÉES RÉELLES) : masthead + recherche réelle + sujets, UNE bande personnelle à
// trois états (todo à trancher / à jour / masquée) pilotée par le vrai compteur de candidats du
// test et par tes accords réels, puis le FLUX des suivis (CarteSuivi : % proche par défaut,
// « comme toi » quand tu t'es situé sur ce scrutin). Repli « duel » quand rien de neuf.

export function AccueilAccordsScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const je = useJe();
  const follows = useFollows();
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
  const flux = (votes ?? []).slice(0, 4);
  const sujets = [...cats].sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0)).slice(0, 6);

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
  // 1re lettre remplaçait tout l'arbre → le TextInput était démonté/remonté → perte du focus
  // (le curseur sortait du champ). Les blocs conditionnels `!recherche && …` renvoient `false`
  // aux mêmes index → la position du champ ne bouge pas d'un rendu à l'autre.
  const recherche = !!q.trim();
  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      {/* 1 — Masthead (caché en mode recherche pour laisser la place aux résultats) */}
      {!recherche && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 }}>
          <ScrutoirMark size={30} color={C.text} />
          <Text style={[T.title, { fontFamily: F.extra, color: C.text, letterSpacing: -0.4 }]}>Scrutoir</Text>
        </View>
      )}

      {/* 2 — Recherche (position STABLE = garde le focus) + sujets (accueil seul) */}
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

      {/* 3 & 4 — reste de l'accueil (bande perso + flux/duel), masqué en mode recherche */}
      {!recherche && (
        <>
      {/* 3 — Bande personnelle. Dès que tu t'es situé (accords > 0), l'accès « Tes accords »
          est PRIORITAIRE (sinon il resterait caché tant qu'il reste des scrutins à trancher,
          c-à-d presque toujours). Le « à trancher » devient alors un nudge secondaire. */}
      {accordsCount > 0 ? (
        <View style={{ marginHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "accords" })} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.adopteBg, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 13 }}>
            <View style={{ width: 40 }}><ScrutoirMark size={40} color={C.pour} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={[T.small, { fontFamily: F.extra, color: C.text }]}>Tes accords</Text>
                <MaterialCommunityIcons name="check-circle" size={15} color={C.pour} />
              </View>
              <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>Situé sur {accordsCount} texte{accordsCount > 1 ? "s" : ""} · vois qui vote comme toi</Text>
            </View>
            <Text style={[T.small, { fontFamily: F.extra, color: C.accent }]}>Voir ›</Text>
          </TouchableOpacity>
          {todo > 0 && (
            <TouchableOpacity onPress={() => nav.push({ name: "test", mode: "affiner" })} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9, paddingHorizontal: 2 }} hitSlop={6}>
              <Feather name="plus-circle" size={13} color={C.textMuted} />
              <Text style={[T.micro, { color: C.textMuted }]}>{todo} nouveau{todo > 1 ? "x" : ""} scrutin{todo > 1 ? "s" : ""} à trancher</Text>
              <Text style={[T.micro, { fontFamily: F.extra, color: C.accent, marginLeft: "auto" }]}>Trancher ›</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : todo > 0 ? (
        <TouchableOpacity activeOpacity={0.85} onPress={() => nav.push({ name: "test", mode: "affiner" })} style={{ flexDirection: "row", alignItems: "center", gap: 13, marginHorizontal: 16, marginTop: 16, backgroundColor: C.accent, borderRadius: 16, padding: 14, overflow: "hidden" }}>
          <View style={{ position: "absolute", right: -10, top: -6, opacity: 0.16 }} pointerEvents="none"><ScrutoirMark size={80} color={C.onAccent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[T.small, { fontFamily: F.extra, color: C.onAccent }]}>{todo} scrutin{todo > 1 ? "s" : ""} à trancher</Text>
            <Text style={[T.micro, { color: C.onAccent, opacity: 0.8, marginTop: 2 }]}>Situe-toi pour découvrir tes accords.</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[T.small, { fontFamily: F.extra, color: C.onAccent }]}>Trancher</Text>
            <Feather name="arrow-right" size={16} color={C.onAccent} />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* 4 — Fil des suivis, ou repli duel */}
      {votes == null ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 24 }} />
      ) : flux.length > 0 ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 2 }}>
            <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Depuis ta dernière visite</Text>
            <Text style={[T.micro, { color: C.textMuted, marginTop: 1 }]}>Les votes récents de tes suivis — comme toi, ou proximité globale.</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 9 }}>
            {flux.map((v) => <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />)}
          </View>
        </>
      ) : (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 2 }}>
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
        </>
      )}
        </>
      )}
    </ScrollView>
  );
}
