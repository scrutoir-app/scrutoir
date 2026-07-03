import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, FlatList, ActivityIndicator, TouchableOpacity, LayoutChangeEvent } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard, formatDate } from "../theme";
import { Card } from "../components/ui";
import { getCategories, getScrutinsRecents, getPartis, getTestProximite } from "../api";
import { catUI } from "../categoryUI";
import { HeroCard, useReduceMotion } from "../components/HeroScrutins";
import { useScrutinDateFilter } from "../components/ScrutinDateFilter";
import { ParThemeSwipe } from "../components/ParThemeSwipe";
import { useJe } from "../testProximite/jeProximite";
import { neuvesParTheme } from "../testProximite/config";
import { chargerTest } from "../testProximite/storage";
import type { CategorieRef, ScrutinResume, PartiResume } from "../types";
import type { QuestionProximite } from "../testProximite/score";
import type { Nav } from "../nav";

const SIDE = 18; // marge écran (alignée sur le contenu de l'accueil / du carrousel d'origine)

/** Ligne de thème : picto + libellé + contexte (nb de scrutins, dernier) + chevron. */
function ThemeRow({ c, onPress }: { c: CategorieRef; onPress: () => void }) {
  const ui = catUI(c.id);
  const meta: string[] = [];
  if (c.nb_scrutins != null) meta.push(`${c.nb_scrutins} scrutins`);
  if (c.derniere_date) meta.push(`dernier le ${formatDate(c.derniere_date)}`);

  return (
    <Card
      onPress={onPress}
      padding={12}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 }}
    >
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={ui.icon as any} size={22} color={ui.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{c.libelle}</Text>
        {meta.length > 0 && (
          <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]}>
            {meta.join(" · ")}
          </Text>
        )}
        {c.dernier_titre && (
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 3 }]} numberOfLines={1}>
            Dernier : {c.dernier_titre}
          </Text>
        )}
      </View>
      <Feather name="chevron-right" size={20} color={C.textFaint} />
    </Card>
  );
}

type Vue = "recents" | "themes";

/** Bascule « Récents » / « Par thème » — un segmented control sobre. */
function Bascule({ vue, onChange }: { vue: Vue; onChange: (v: Vue) => void }) {
  const items: { key: Vue; label: string }[] = [
    { key: "recents", label: "Récents" },
    { key: "themes", label: "Par thème" },
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3 }}>
      {items.map((it) => {
        const actif = vue === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            activeOpacity={0.8}
            onPress={() => onChange(it.key)}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 36, borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : null) }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: actif ? C.text : C.textMuted }]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Vue « Récents » : tous les derniers scrutins, tous sujets confondus, en chronologique.
 * Présentation = la carte « hero » signature de l'accueil (kicker, « Adopté · N votants »,
 * barre divergente centrée animée), empilée en LISTE verticale (le carrousel/swipe en moins).
 * L'animation des compteurs se déclenche quand la carte entre à l'écran (suivi de visibilité).
 */
function VueRecents({ nav }: { nav: Nav }) {
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);
  const { filtered, Bar } = useScrutinDateFilter(scrutins ?? []);
  const reduceMotion = useReduceMotion();
  const [boxW, setBoxW] = useState(0);
  const [vues, setVues] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    getScrutinsRecents().then(setScrutins);
  }, []);

  // Suivi de visibilité : une carte « vue » au moins une fois reste animée (identité stable
  // exigée par FlatList → useRef ; mise à jour fonctionnelle pour éviter toute fermeture périmée).
  const onView = useRef((info: { viewableItems: Array<{ key?: string }> }) => {
    setVues((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const it of info.viewableItems) {
        if (it.key && !next.has(it.key)) { next.add(it.key); changed = true; }
      }
      return changed ? next : prev;
    });
  }).current;
  const viewCfg = useRef({ itemVisiblePercentThreshold: 35 }).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== boxW) setBoxW(w);
  };

  const cardW = boxW > 0 ? boxW - SIDE * 2 : 0;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {!scrutins || cardW <= 0 ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.uid}
          contentContainerStyle={{ paddingHorizontal: SIDE, paddingTop: 14, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onView}
          viewabilityConfig={viewCfg}
          ListHeaderComponent={
            <View style={{ paddingBottom: 12 }}>
              <Text style={[T.small, { color: C.textMuted, marginBottom: 12 }]}>
                Les derniers scrutins, tous sujets confondus ({filtered.length})
              </Text>
              {Bar}
            </View>
          }
          renderItem={({ item }) => (
            <HeroCard
              s={item}
              width={cardW}
              active={reduceMotion || vues.has(item.uid)}
              reduceMotion={reduceMotion}
              onPress={() => nav.push({ name: "scrutin", uid: item.uid })}
            />
          )}
        />
      )}
    </View>
  );
}

/**
 * Vue « Par thème » : si un résultat de test existe, on ouvre EN TÊTE « Ta proximité par
 * thème » (le swipe ParThemeSwipe — accessible ici sans repasser par le résultat), puis la
 * navigation par catégories en dessous.
 */
function VueThemes({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);
  const [loading, setLoading] = useState(true);
  const je = useJe();

  useEffect(() => {
    Promise.all([getCategories(), getPartis()]).then(([cs, ps]) => { setCats(cs); setPartis(ps); }).finally(() => setLoading(false));
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);

  const neuf = je ? neuvesParTheme(questions, je.reponses) : undefined;

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      {je && partis.length > 0 && (
        <View style={{ marginBottom: 22 }}>
          <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 12 }]}>Ta proximité par thème</Text>
          <ParThemeSwipe resultat={je.resultat} partis={partis} cats={cats} nav={nav} neufParTheme={neuf} />
        </View>
      )}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 12 }]}>Parcourir par sujet</Text>
      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        [...cats].sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0)).map((c) => (
          <ThemeRow key={c.id} c={c} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
        ))
      )}
    </ScrollView>
  );
}

/**
 * Onglet « Scrutins » : consultation des scrutins. Deux vues d'un même onglet —
 * « Récents » (destination de l'ancien carrousel « Tout voir », tous sujets, chronologique)
 * et « Par thème » (la liste de thèmes historique). Clé de route « themes » conservée.
 */
export function ThemesScreen({ nav }: { nav: Nav }) {
  // Si un test existe, ouvrir d'emblée « Par thème » (le swipe « Ta proximité » est en tête).
  const [vue, setVue] = useState<Vue>(() => {
    const t = chargerTest();
    return t && Object.keys(t.reponses).length ? "themes" : "recents";
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Scrutins</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4, marginBottom: 12 }]}>
          Les derniers votes, ou parcours-les par grand sujet
        </Text>
        <Bascule vue={vue} onChange={setVue} />
      </View>
      <View style={{ flex: 1 }}>
        {vue === "recents" ? <VueRecents nav={nav} /> : <VueThemes nav={nav} />}
      </View>
    </View>
  );
}
