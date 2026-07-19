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

// Accord par thème (DONNÉES RÉELLES) dérivé des réponses au test (localStorage) :
//   · jamais situé (0 réponse dans le thème)        → corpus  (« Situe-toi / Parcourir »)
//   · situé mais des candidats restent à trancher   → trancher (« +N à te positionner »)
//   · situé et plus rien à trancher dans le thème   → situe    (« Situé sur N · Voir tes accords »)
// Aucun hémicycle agrégé : l'accord est un libellé cliquable vers le détail scrutin par scrutin.
type AccordTheme = { state: "situe" | "trancher" | "corpus"; n: number };
function accordDeTheme(themeId: string, situe: Record<string, number>, todo: Record<string, number>): AccordTheme {
  const s = situe[themeId] ?? 0;
  const t = todo[themeId] ?? 0;
  if (s === 0) return { state: "corpus", n: 0 };
  if (t > 0) return { state: "trancher", n: t };
  return { state: "situe", n: s };
}

/**
 * Carte de thème « Tes accords par thème » : deux couches superposées.
 * 1) CORPUS (transparence, pour tous) : icône + nom + « N scrutins publics · dernier le … »,
 *    toucher ouvre la liste du thème. 2) ACCORD (calque perso si situé), en pied, 3 états.
 * Aucun hémicycle agrégé au niveau du thème : l'accord est un libellé cliquable vers le détail.
 */
function ThemeAccordCard({ c, accord, nav }: { c: CategorieRef; accord: AccordTheme; nav: Nav }) {
  const ui = catUI(c.id);
  const corpus = `${c.nb_scrutins ?? 0} scrutins publics${c.derniere_date ? ` · dernier le ${formatDate(c.derniere_date)}` : ""}`;
  const ouvrirCorpus = () => nav.push({ name: "categorie", id: c.id, libelle: c.libelle });

  return (
    <Card padding={14} style={{ marginBottom: 11 }}>
      {/* Couche 1 — corpus (toujours visible) */}
      <TouchableOpacity activeOpacity={0.7} onPress={ouvrirCorpus} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={22} color={ui.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.body, { fontFamily: F.extra, color: C.text }]}>{c.libelle}</Text>
          <Text style={[T.micro, { color: C.textMuted, marginTop: 3 }]}>{corpus}</Text>
        </View>
      </TouchableOpacity>

      {/* Couche 2 — accord (calque perso) */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: C.border }}>
        {accord.state === "situe" ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MaterialCommunityIcons name="check-circle" size={16} color={C.pour} />
              <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Situé sur {accord.n} scrutins</Text>
            </View>
            <TouchableOpacity onPress={() => nav.push({ name: "accords" })} hitSlop={8}>
              <Text style={[T.small, { fontFamily: F.extra, color: C.accent }]}>Voir tes accords ›</Text>
            </TouchableOpacity>
          </>
        ) : accord.state === "trancher" ? (
          <>
            <Text style={[T.small, { color: C.textMuted }]}>Pas encore à jour</Text>
            <TouchableOpacity onPress={() => nav.push({ name: "test", mode: "affiner", theme: c.id, themeLibelle: c.libelle })} activeOpacity={0.8} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={[T.micro, { fontFamily: F.extra, color: C.onAccent }]}>+{accord.n} à te positionner</Text>
              <Feather name="arrow-right" size={13} color={C.onAccent} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[T.small, { color: C.textMuted }]}>Situe-toi pour voir tes accords</Text>
            <TouchableOpacity onPress={ouvrirCorpus} hitSlop={8}>
              <Text style={[T.small, { fontFamily: F.extra, color: C.accent }]}>Parcourir ›</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Card>
  );
}

/**
 * Vue « Par thème » = vue par thème de Tes accords. Chaque thème porte son CORPUS (transparence,
 * pour tous) et, en pied, l'ACCORD (calque perso si situé). Remplace l'ancien carrousel « Ta
 * proximité par thème » (mot « convergence » supprimé) : plus d'hémicycle agrégé par thème.
 */
function VueThemes({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [questions, setQuestions] = useState<QuestionProximite[]>([]);
  const [loading, setLoading] = useState(true);
  const je = useJe();

  useEffect(() => {
    getCategories().then(setCats).finally(() => setLoading(false));
    getTestProximite().then(setQuestions).catch(() => setQuestions([]));
  }, []);

  // Par thème : nb de candidats du test encore à trancher (neuvesParTheme) + nb déjà tranchés.
  const todo = je ? neuvesParTheme(questions, je.reponses) : {};
  const situe: Record<string, number> = {};
  if (je) for (const q of questions) {
    const r = je.reponses[q.id];
    if (r === "pour" || r === "contre") situe[q.theme] = (situe[q.theme] ?? 0) + 1;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Tes accords par thème</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 1, marginBottom: 14 }]}>
        Chaque thème, son corpus de votes et, si tu t'es situé, tes accords en détail.
      </Text>
      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        [...cats]
          .sort((a, b) => (b.nb_scrutins ?? 0) - (a.nb_scrutins ?? 0))
          .map((c) => <ThemeAccordCard key={c.id} c={c} accord={accordDeTheme(c.id, situe, todo)} nav={nav} />)
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
