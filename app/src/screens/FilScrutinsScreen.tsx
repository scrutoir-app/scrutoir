import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, shadowCard } from "../theme";
import { useThemeMode } from "../themeMode";
import { getScrutinsRecents, getCategories } from "../api";
import { catUI } from "../categoryUI";
import { useJe } from "../testProximite/jeProximite";
import { chargerTest } from "../testProximite/storage";
import { FilScrutinCard } from "../components/FilScrutinCard";
import { ListeScrutinCard } from "../components/ListeScrutinCard";
import { OnboardingFil } from "../components/OnboardingFil";
import { LegendeVerdict } from "../components/LegendeVerdict";
import { ScrutinShareSheet } from "../components/ScrutinShareSheet";
import type { ScrutinResume, CategorieRef } from "../types";
import type { Reponse } from "../testProximite/score";
import type { Nav } from "../nav";

type Vue = "fil" | "liste";

// Hauteur de la barre de contrôles en surimpression (bascule + filtres). Les slides du Fil
// passent DESSOUS (topInset), la Liste réserve ce padding en haut.
const TOPBAR_H = 100;

// Flags « vu une fois » (localStorage web ; sinon no-op).
const seen = (k: string) => { try { return typeof localStorage !== "undefined" && localStorage.getItem(k) === "1"; } catch { return false; } };
const markSeen = (k: string) => { try { if (typeof localStorage !== "undefined") localStorage.setItem(k, "1"); } catch { /* ignore */ } };
const FLAG_OB = "scrutoir.fil.onboardingSeen";
const FLAG_LEG = "scrutoir.fil.legendeSeen";

/** Utilisateur situé = au moins une réponse pour/contre au test (sync). */
function estSitue(): boolean {
  const t = chargerTest();
  return !!t && Object.values(t.reponses).some((r) => r === "pour" || r === "contre");
}

const inCat = (s: ScrutinResume & { cats?: string[] }, id: string) =>
  (s.cats?.length ? s.cats.includes(id) : s.categorie === id);

/** Bascule Fil | Liste (segmented control du design system). */
function BasculeVue({ vue, onChange }: { vue: Vue; onChange: (v: Vue) => void }) {
  const items: { key: Vue; label: string }[] = [
    { key: "fil", label: "Fil" },
    { key: "liste", label: "Liste" },
  ];
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3, ...shadowCard }}>
      {items.map((it) => {
        const actif = vue === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            activeOpacity={0.8}
            onPress={() => onChange(it.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            style={{ paddingHorizontal: S.s20, height: 34, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : null) }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: actif ? C.text : C.textMuted }]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Rangée de filtres par catégorie, PARTAGÉE entre Fil et Liste. Style « glassy » lisible sur l'immersif. */
function FiltresCategorie({ cats, filter, onFilter }: { cats: CategorieRef[]; filter: string | null; onFilter: (id: string | null) => void }) {
  const Puce = ({ id, label }: { id: string | null; label: string }) => {
    const actif = filter === id;
    return (
      <TouchableOpacity
        onPress={() => onFilter(id)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Filtrer : ${label}`}
        accessibilityState={{ selected: actif }}
        style={{ height: 36, justifyContent: "center", paddingHorizontal: S.s14, borderRadius: RADIUS.pill, backgroundColor: actif ? C.accent : C.glass }}
      >
        <Text style={[T.small, { fontFamily: F.bold, color: actif ? C.onAccent : C.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.s8, paddingHorizontal: S.s16 }}>
      <Puce id={null} label="Tous" />
      {cats.map((c) => <Puce key={c.id} id={c.id} label={catUI(c.id).court ?? c.libelle} />)}
    </ScrollView>
  );
}

export function FilScrutinsScreen({ nav }: { nav: Nav }) {
  const { effective, setPref } = useThemeMode();
  const [vue, setVue] = useState<Vue>("fil");
  const [filter, setFilter] = useState<string | null>(null);
  const [scrutins, setScrutins] = useState<ScrutinResume[] | null>(null);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [boxH, setBoxH] = useState(0);
  const [boxW, setBoxW] = useState(0);

  const ctx = useJe();
  const [situe] = useState(estSitue);
  const reponses: Record<number, Reponse> = chargerTest()?.reponses ?? {};

  const [onboarding, setOnboarding] = useState(false);
  const [legende, setLegende] = useState(false);
  const [share, setShare] = useState<ScrutinResume | null>(null);

  useEffect(() => {
    getScrutinsRecents(150).then(setScrutins);
    getCategories().then(setCats).catch(() => setCats([]));
  }, []);

  // Auto une fois : invitation si pas situé, sinon légende (rattrapable ensuite via les pastilles).
  useEffect(() => {
    if (!situe && !seen(FLAG_OB)) { setOnboarding(true); markSeen(FLAG_OB); }
    else if (situe && !seen(FLAG_LEG)) { setLegende(true); markSeen(FLAG_LEG); }
  }, [situe]);

  const shown = useMemo(
    () => (scrutins ?? []).filter((s) => !filter || inCat(s as any, filter)),
    [scrutins, filter]
  );
  // Catégories réellement présentes dans la liste chargée (évite les filtres vides).
  const catsPresentes = useMemo(() => {
    const ids = new Set<string>();
    (scrutins ?? []).forEach((s: any) => (s.cats?.length ? s.cats : [s.categorie]).forEach((c: string) => c && ids.add(c)));
    return cats.filter((c) => ids.has(c.id));
  }, [cats, scrutins]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (height && height !== boxH) setBoxH(height);
    if (width && width !== boxW) setBoxW(width);
  };

  const ouvrirVerdict = () => (situe ? setLegende(true) : setOnboarding(true));
  const openDetail = (uid: string) => nav.push({ name: "scrutin", uid });
  const fil = vue === "fil";

  return (
    <View style={{ flex: 1 }}>
      {/* Contenu plein cadre (la barre est en surimpression, cf. plus bas) */}
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {!scrutins ? (
          <ActivityIndicator color={C.textMuted} style={{ marginTop: TOPBAR_H + 40 }} />
        ) : fil ? (
          boxH > 0 && boxW > 0 ? (
            <FlatList
              key={filter ?? "tous"}
              data={shown}
              keyExtractor={(s) => s.uid}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={boxH}
              snapToAlignment="start"
              decelerationRate="fast"
              getItemLayout={(_, index) => ({ length: boxH, offset: boxH * index, index })}
              ListEmptyComponent={<View style={{ height: boxH, alignItems: "center", justifyContent: "center" }}><Text style={[T.callout, { color: C.textFaint }]}>Aucun scrutin</Text></View>}
              renderItem={({ item, index }) => (
                <FilScrutinCard
                  scrutin={item}
                  height={boxH}
                  width={boxW}
                  topInset={TOPBAR_H}
                  ctx={ctx}
                  situe={situe}
                  reponse={item.numero != null ? reponses[item.numero] : undefined}
                  isFirst={index === 0}
                  onDetail={() => openDetail(item.uid)}
                  onShare={() => setShare(item)}
                  onVerdict={ouvrirVerdict}
                />
              )}
            />
          ) : null
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: TOPBAR_H + S.s8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {shown.length === 0 ? (
              <Text style={[T.callout, { color: C.textFaint, textAlign: "center", marginTop: 40 }]}>Aucun scrutin</Text>
            ) : (
              shown.map((s) => (
                <ListeScrutinCard
                  key={s.uid}
                  scrutin={s}
                  ctx={ctx}
                  situe={situe}
                  reponse={s.numero != null ? reponses[s.numero] : undefined}
                  onDetail={() => openDetail(s.uid)}
                  onVerdict={ouvrirVerdict}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* Barre de contrôles EN SURIMPRESSION : bascule + réglage thème + filtres.
            Fil = fond transparent + box-none (le feed défile derrière) ; Liste = fond plein. */}
        <View
          pointerEvents={fil ? "box-none" : "auto"}
          style={{ position: "absolute", left: 0, top: 0, right: 0, zIndex: 20, paddingTop: S.s12, paddingBottom: S.s8, backgroundColor: fil ? "transparent" : C.bg }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: S.s16 }}>
            <View style={{ flex: 1 }} />
            <BasculeVue vue={vue} onChange={setVue} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setPref(effective === "dark" ? "light" : "dark")}
                accessibilityRole="button"
                accessibilityLabel="Basculer le thème clair/sombre"
                style={{ width: 36, height: 36, borderRadius: RADIUS.pill, backgroundColor: fil ? C.glass : C.surfaceAlt, alignItems: "center", justifyContent: "center" }}
              >
                <Feather name={effective === "dark" ? "sun" : "moon"} size={ICON.md} color={fil ? C.text : C.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ marginTop: S.s10 }}>
            <FiltresCategorie cats={catsPresentes} filter={filter} onFilter={setFilter} />
          </View>
        </View>
      </View>

      {/* Overlays */}
      <OnboardingFil
        visible={onboarding}
        onStart={() => { setOnboarding(false); nav.push({ name: "testIntro" }); }}
        onClose={() => setOnboarding(false)}
      />
      <LegendeVerdict visible={legende} onClose={() => setLegende(false)} />
      {share && <ScrutinShareSheet scrutin={share} onClose={() => setShare(null)} />}
    </View>
  );
}
