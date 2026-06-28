import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, inputText, RADIUS, shadowCard, positionLabel, couleurPosition, getScheme } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis, getTestProximite } from "../api";
import { useFollows } from "../follows";
import { chargerTest } from "../testProximite/storage";
import { useJe, useProximiteDepute, scoreGroupeJe, type ContexteJe, type ProximiteScore } from "../testProximite/jeProximite";
import { nbNeuves, SEUIL_AFFINER } from "../testProximite/config";
import type { QuestionProximite } from "../testProximite/score";
import type { VoteSuivi, PartiResume } from "../types";
import type { Nav } from "../nav";
import { SearchResultsList } from "../components/SearchResultsList";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { HemicyclePicto } from "../components/HemicyclePicto";

const SIDE = 18;
const EXEMPLES = ["Pouvoir d'achat", "Santé", "Europe", "Médicaments", "Logement", "Écologie"];

// Aplat « encre » du héros recherche (contrasté dans les deux thèmes).
function heroTokens() {
  const dark = getScheme() === "dark";
  return {
    bg: dark ? "#2A323E" : "#161A20",
    border: dark ? "#414C5C" : "rgba(255,255,255,0.08)",
    title: "#FFFFFF",
    sub: "rgba(255,255,255,0.74)",
    tagBg: "rgba(255,255,255,0.10)",
    tagBorder: "rgba(255,255,255,0.22)",
    tagFg: "rgba(255,255,255,0.95)",
  };
}

/** En-tête de marque (logo prod intouché) + accès Suivis (cloche). */
function Masthead({ nav }: { nav: Nav }) {
  return (
    <View style={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <ScrutoirLogo wordHeight={31} color={C.text} accent={C.accent} />
      <TouchableOpacity
        onPress={() => nav.push({ name: "suivis" })}
        accessibilityRole="button"
        accessibilityLabel="Mes suivis"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong, ...shadowCard }}
      >
        <Feather name="bell" size={18} color={C.accent} />
      </TouchableOpacity>
    </View>
  );
}

/** Champ de recherche en pill blanc (16 px → pas de zoom iOS au focus). */
function SearchPill({ q, setQ, autoFocus }: { q: string; setQ: (s: string) => void; autoFocus?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 52, backgroundColor: "#FFFFFF", borderRadius: RADIUS.md, paddingHorizontal: 13 }}>
      <Feather name="search" size={19} color="#171A1F" />
      <TextInput
        value={q}
        onChangeText={setQ}
        autoFocus={autoFocus}
        placeholder="Sur quoi ils ont voté ?"
        placeholderTextColor="#8A8F98"
        style={[inputText, { flex: 1, color: "#171A1F", outlineStyle: "none" }] as any}
        autoCorrect={false}
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color="#8A8F98" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Héros recherche — aplat sombre signature (champ + puces sujets). Relégué SOUS le fil. */
function HeroRecherche({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  const h = heroTokens();
  return (
    <View style={{ backgroundColor: h.bg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: h.border, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14, ...shadowCard }}>
      <Text style={[T.heading, { color: h.title }]}>Sur quoi ils ont voté ?</Text>
      <Text style={[T.small, { color: h.sub, marginTop: 4, marginBottom: 12 }]}>Tape un sujet, un nom ou une loi</Text>
      <SearchPill q={q} setQ={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {EXEMPLES.map((ex) => (
          <TouchableOpacity key={ex} activeOpacity={0.7} onPress={() => setQ(ex)} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: RADIUS.pill, backgroundColor: h.tagBg, borderWidth: 1, borderColor: h.tagBorder }}>
            <Text style={[T.small, { fontFamily: F.semibold, color: h.tagFg }]}>{ex}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const enRecherche = q.trim().length >= 2;

  if (enRecherche) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: SIDE, paddingTop: 10 }}>
          <SearchPill q={q} setQ={setQ} autoFocus />
        </View>
        <View style={{ flex: 1, marginTop: 8 }}>
          <SearchResultsList q={q} nav={nav} onCorriger={setQ} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Masthead nav={nav} />
      <Accueil q={q} setQ={setQ} nav={nav} />
    </ScrollView>
  );
}

/**
 * Accueil allégé, deux états :
 *  - revenant (suit des élus et/ou des partis) : fil « Depuis ta dernière visite » — un vote
 *    récent par entité, ÉLUS et PARTIS mêlés, priorisé par le poids des thèmes (Fort en haut,
 *    Peu relégué ; à égalité, chronologique) ; puis le héros de recherche (relégué) et l'accès
 *    « Ta proximité » (avec « Affiner » dès qu'assez de votes neufs existent) ;
 *  - nouveau (aucun suivi) : état vide « Tu ne suis encore personne » + « Faire le test » +
 *    « Trouver mon député ».
 */
function Accueil({ q, setQ, nav }: { q: string; setQ: (s: string) => void; nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const je = useJe();
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);

  useEffect(() => {
    getPartis().then(setPartis);
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);

  useEffect(() => {
    let alive = true;
    if (deputeUids.length || partiUids.length) {
      setItems(null);
      Promise.all([getVotesSuivis(deputeUids, 60), getVotesPartisSuivis(partiUids, 60)]).then(([d, p]) => {
        if (alive) setItems([...d, ...p]);
      });
    } else {
      setItems([]);
    }
    return () => { alive = false; };
  }, [deputeUids.join(","), partiUids.join(",")]);

  // Pondération : le poids du thème (du test) pousse les votes « Fort » en haut et relègue
  // les « Peu ». Un vote par entité (celui de poids le plus fort, sinon le plus récent).
  const poids = je?.poids ?? {};
  const w = (cat: string | null | undefined) => poids[cat ?? ""] ?? 1;
  const feed = (() => {
    const best = new Map<string, VoteSuivi>();
    for (const v of items ?? []) {
      const cur = best.get(v.deputeUid);
      if (!cur || w(v.categorie) > w(cur.categorie) || (w(v.categorie) === w(cur.categorie) && (v.date || "") > (cur.date || ""))) {
        best.set(v.deputeUid, v);
      }
    }
    return [...best.values()]
      .sort((a, b) => w(b.categorie) - w(a.categorie) || (b.date || "").localeCompare(a.date || ""))
      .slice(0, 6);
  })();

  // État NOUVEAU : aucun suivi → état vide centré.
  if (!deputeUids.length && !partiUids.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 60 }}>
        <HemicyclePicto groupes={partis} activeAbrev={null} color={C.textFaint} size={88} />
        <Text style={[T.title, { fontFamily: F.extra, color: C.text, textAlign: "center", marginTop: 18 }]}>Tu ne suis encore personne</Text>
        <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: 10 }]}>
          Fais le test pour voir de qui tu es proche, ou cherche directement ton député.
        </Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => nav.push({ name: "testIntro" })} style={{ alignSelf: "stretch", marginTop: 28, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: "center", ...shadowCard }}>
          <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Faire le test · 2 min</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "monDepute" })} style={{ marginTop: 18 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Trouver mon député</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // État REVENANT.
  const test = chargerTest();
  const aTest = !!test && Object.keys(test.reponses).length > 0;
  const neuves = aTest && questions.length ? nbNeuves(questions, test!.reponses) : 0;
  const affinerDispo = aTest && neuves >= SEUIL_AFFINER;
  const ouvrirProximite = () =>
    aTest ? nav.push({ name: "testResultat" }) : nav.push({ name: "testIntro" });

  return (
    <View style={{ paddingHorizontal: SIDE }}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text, marginTop: 6 }]}>Depuis ta dernière visite</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 14 }]}>Ce qu'ont voté tes suivis</Text>

      {items === null ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 20 }} />
      ) : feed.length === 0 ? (
        <Text style={[T.small, { color: C.textMuted, marginBottom: 14 }]}>Aucun vote nominatif récent pour tes suivis.</Text>
      ) : (
        <View style={{ gap: 9, marginBottom: 16 }}>
          {feed.map((v) => (
            <FeedItemCard key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />
          ))}
        </View>
      )}

      <HeroRecherche q={q} setQ={setQ} />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={ouvrirProximite}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 16, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
      >
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Ta proximité</Text>
        {affinerDispo ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "test", mode: "affiner" })} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{neuves} nouveaux votes</Text>
            <Feather name="chevron-right" size={17} color={C.accent} />
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{aTest ? "Voir" : "Faire le test"}</Text>
            <Feather name="chevron-right" size={17} color={C.accent} />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Aiguille une entrée du fil vers la bonne carte (élu PA… / parti PO…). */
function FeedItemCard({ v, partis, je, nav }: { v: VoteSuivi; partis: PartiResume[]; je: ContexteJe | null; nav: Nav }) {
  if (v.deputeUid.startsWith("PO")) {
    return <FeedCard v={v} partis={partis} score={scoreGroupeJe(je, v.abrev)} nav={nav} />;
  }
  return <FeedCardDepute v={v} partis={partis} nav={nav} />;
}

function FeedCardDepute({ v, partis, nav }: { v: VoteSuivi; partis: PartiResume[]; nav: Nav }) {
  return <FeedCard v={v} partis={partis} score={useProximiteDepute(v.deputeUid)} nav={nav} />;
}

/** Carte du fil : picto du groupe + nom + position (couleur du vote) · titre + « % comme toi ». */
function FeedCard({ v, partis, score, nav }: { v: VoteSuivi; partis: PartiResume[]; score: ProximiteScore | null; nav: Nav }) {
  const estParti = v.deputeUid.startsWith("PO");
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })}
      style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
    >
      <HemicyclePicto groupes={partis} activeAbrev={v.abrev} color={v.couleur ?? C.textFaint} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push(estParti ? { name: "parti", uid: v.deputeUid } : { name: "depute", uid: v.deputeUid })}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{v.nom}</Text>
        </TouchableOpacity>
        <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]} numberOfLines={2}>
          <Text style={{ fontFamily: F.bold, color: couleurPosition(v.position) }}>{positionLabel(v.position)}</Text>
          {v.titre ? ` · ${v.titre}` : ""}
        </Text>
      </View>
      {score && (
        <View style={{ alignItems: "flex-end", marginLeft: 2 }}>
          <Text style={[T.heading, { fontFamily: F.extra, color: C.text }]}>{Math.round(score.pct * 100)}%</Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>comme toi</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
