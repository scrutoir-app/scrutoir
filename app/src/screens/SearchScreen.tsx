import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, inputText, RADIUS, shadowCard, positionLabel, couleurPosition } from "../theme";
import { getVotesSuivis, getPartis } from "../api";
import { useFollows } from "../follows";
import { chargerTest } from "../testProximite/storage";
import { useProximiteDepute } from "../testProximite/jeProximite";
import type { VoteSuivi, PartiResume } from "../types";
import type { Nav } from "../nav";
import { SearchResultsList } from "../components/SearchResultsList";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { HemicyclePicto } from "../components/HemicyclePicto";

const SIDE = 18;

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

/** Champ de recherche en pill (16 px → pas de zoom iOS au focus). */
function SearchPill({ q, setQ, autoFocus }: { q: string; setQ: (s: string) => void; autoFocus?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 11, height: 54,
        backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 15,
        borderWidth: 1, borderColor: C.borderStrong, ...shadowCard,
      }}
    >
      <Feather name="search" size={19} color={C.textMuted} />
      <TextInput
        value={q}
        onChangeText={setQ}
        autoFocus={autoFocus}
        placeholder="Sur quoi ils ont voté ?"
        placeholderTextColor={C.textMuted}
        style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
        autoCorrect={false}
      />
      {q.length > 0 && (
        <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const enRecherche = q.trim().length >= 2;

  // Mode résultats : champ épinglé en haut + liste.
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
 * Accueil ALLÉGÉ, deux états (cf. maquettes) :
 *  - revenant (a des suivis) : fil « Depuis ta dernière visite » (dernier vote de chaque
 *    suivi, couleur du vote + « tu votes comme % »), puis recherche + accès « Ta proximité » ;
 *  - nouveau (aucun suivi) : état vide « Tu ne suis encore personne » + « Faire le test » +
 *    « Trouver mon député » (l'overlay d'onboarding, lui, se déclenche au tout 1er lancement).
 */
function Accueil({ q, setQ, nav }: { q: string; setQ: (s: string) => void; nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);

  useEffect(() => {
    getPartis().then(setPartis);
  }, []);

  useEffect(() => {
    let alive = true;
    if (deputeUids.length) {
      setItems(null);
      getVotesSuivis(deputeUids, 40).then((r) => { if (alive) setItems(r); });
    } else {
      setItems([]);
    }
    return () => { alive = false; };
  }, [deputeUids.join(",")]);

  // Un seul vote (le plus récent) par élu suivi.
  const parElu = (() => {
    const vus = new Set<string>();
    const out: VoteSuivi[] = [];
    for (const v of items ?? []) {
      if (vus.has(v.deputeUid)) continue;
      vus.add(v.deputeUid);
      out.push(v);
    }
    return out.slice(0, 6);
  })();

  // État NOUVEAU : aucun suivi → état vide centré (pas de feed vide).
  if (!deputeUids.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 30, paddingTop: 60 }}>
        <HemicyclePicto groupes={partis} activeAbrev={null} color={C.textFaint} size={88} />
        <Text style={[T.title, { fontFamily: F.extra, color: C.text, textAlign: "center", marginTop: 18 }]}>
          Tu ne suis encore personne
        </Text>
        <Text style={[T.body, { color: C.textMuted, textAlign: "center", marginTop: 10 }]}>
          Fais le test pour voir de qui tu es proche, ou cherche directement ton député.
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => nav.push({ name: "testIntro" })}
          style={{ alignSelf: "stretch", marginTop: 28, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: "center", ...shadowCard }}
        >
          <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Faire le test · 2 min</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav.push({ name: "monDepute" })} style={{ marginTop: 18 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Trouver mon député</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // État REVENANT : fil des suivis + recherche + accès proximité.
  const test = chargerTest();
  const aTest = !!test && Object.keys(test.reponses).length > 0;
  const ouvrirProximite = () =>
    aTest ? nav.push({ name: "testResultat", reponses: test!.reponses, poids: test!.poids }) : nav.push({ name: "testIntro" });

  return (
    <View style={{ paddingHorizontal: SIDE }}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text, marginTop: 6 }]}>Depuis ta dernière visite</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 3, marginBottom: 14 }]}>Ce qu'ont voté tes suivis</Text>

      {items === null ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 20 }} />
      ) : parElu.length === 0 ? (
        <Text style={[T.small, { color: C.textMuted, marginBottom: 14 }]}>Aucun vote nominatif récent pour tes élus suivis.</Text>
      ) : (
        <View style={{ gap: 9, marginBottom: 16 }}>
          {parElu.map((v) => (
            <FeedSuiviCard key={v.deputeUid + v.scrutinUid} v={v} partis={partis} nav={nav} />
          ))}
        </View>
      )}

      <SearchPill q={q} setQ={setQ} />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={ouvrirProximite}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 15, paddingHorizontal: 16, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}
      >
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Ta proximité</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>{aTest ? "Affiner" : "Faire le test"}</Text>
          <Feather name="chevron-right" size={17} color={C.accent} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

/** Carte d'un suivi : picto du groupe + nom + position (couleur du vote) · titre + « % comme toi ». */
function FeedSuiviCard({ v, partis, nav }: { v: VoteSuivi; partis: PartiResume[]; nav: Nav }) {
  const score = useProximiteDepute(v.deputeUid);
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })}
      style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
    >
      <HemicyclePicto groupes={partis} activeAbrev={v.abrev} color={v.couleur ?? C.textFaint} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push({ name: "depute", uid: v.deputeUid })}>
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
