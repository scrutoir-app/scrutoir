import React, { useState } from "react";
import { View, Text, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, LayoutChangeEvent, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, shadowCard } from "../theme";
import { useThemeMode } from "../themeMode";
import { useJe } from "../testProximite/jeProximite";
import { chargerTest } from "../testProximite/storage";
import type { Reponse } from "../testProximite/score";
import { FilScrutinCard } from "./FilScrutinCard";
import { ListeScrutinCard } from "./ListeScrutinCard";
import { OnboardingFil } from "./OnboardingFil";
import { LegendeVerdict } from "./LegendeVerdict";
import { ScrutinShareSheet } from "./ScrutinShareSheet";
import type { ScrutinResume } from "../types";

export type Vue = "fil" | "liste";

/** En-tête de contexte optionnel (au-dessus des filtres) : « Votes du groupe » / « GDR · Écologie · N scrutins ». */
export type ScrutinListContexte = { titre?: string; sousTitre?: string };

/** Utilisateur situé = au moins une réponse pour/contre au test (sync, lu au montage). */
function estSitue(): boolean {
  const t = chargerTest();
  return !!t && Object.values(t.reponses).some((r) => r === "pour" || r === "contre");
}

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
            accessibilityLabel={`Vue ${it.label}`}
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

/**
 * Liste de scrutins MUTUALISÉE : une seule implémentation pour toute l'app (fil immersif + vue
 * scannable), avec bascule Fil | Liste, en-tête de contexte, slot de filtres propres à l'écran,
 * verdict « comme toi » (verrouillé si non situé) et rail Détail / Garder / Partager — tout arrive
 * automatiquement via les cartes. Consultation seule (jamais de vote/like/compteur).
 *
 * Un seul état partagé pilote les deux vues : `scrutins` arrive DÉJÀ FILTRÉ par l'écran (les
 * filtres vivent au-dessus de la bascule → basculer Fil/Liste ne réinitialise rien), et le slot
 * `filtres` (barres de chips de l'écran) est simplement placé dans l'en-tête.
 */
export function ScrutinList<T extends ScrutinResume>({
  scrutins,
  contexte,
  filtres,
  vueInitiale = "fil",
  themeToggle = false,
  emptyLabel = "Aucun scrutin",
  onDetail,
  onSituer,
  renderAnnotation,
}: {
  scrutins: T[] | null; // null = en cours de chargement
  contexte?: ScrutinListContexte;
  filtres?: React.ReactNode; // barres de filtres de l'écran (état possédé par l'écran)
  vueInitiale?: Vue;
  themeToggle?: boolean; // affiche le bouton clair/sombre à droite de la bascule
  emptyLabel?: string;
  onDetail: (uid: string) => void;
  onSituer?: () => void; // route vers le test (invite affichée sur pastille verrouillée)
  renderAnnotation?: (s: T) => React.ReactNode; // slot par-item (ex. consigne/écart, dissidence)
}) {
  const { effective, setPref } = useThemeMode();
  const [vue, setVue] = useState<Vue>(vueInitiale);
  const ctx = useJe();
  const [situe] = useState(estSitue);
  const reponses: Record<number, Reponse> = chargerTest()?.reponses ?? {};

  const [legende, setLegende] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [share, setShare] = useState<ScrutinResume | null>(null);

  // On mesure DIRECTEMENT le conteneur du corps (et non total − header) : plus robuste, aucune
  // dépendance à une soustraction ni au refire de deux onLayout. Fallback Dimensions pour la
  // première frame afin que le Fil ne se rende jamais vide en attendant la mesure.
  const win = Dimensions.get("window");
  const [bodyH, setBodyH] = useState(0);
  const [bodyW, setBodyW] = useState(0);
  const onBodyLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (height && height !== bodyH) setBodyH(height);
    if (width && width !== bodyW) setBodyW(width);
  };
  const filH = bodyH || win.height;
  const filW = bodyW || win.width;
  const fil = vue === "fil";
  const data = scrutins ?? [];

  // Verdict verrouillé si non situé : la pastille ouvre l'invite à se situer ; sinon la légende.
  const ouvrirVerdict = () => (situe ? setLegende(true) : setOnboarding(true));

  return (
    <View style={{ flex: 1 }}>
      {/* En-tête solide : contexte + bascule + filtres. Toujours lisible (bande pleine, pas d'overlay). */}
      <View style={{ backgroundColor: C.bg, paddingTop: S.s12, paddingBottom: S.s10, zIndex: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: S.s16 }}>
          <View style={{ flex: 1 }} />
          <BasculeVue vue={vue} onChange={setVue} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            {themeToggle && (
              <TouchableOpacity
                onPress={() => setPref(effective === "dark" ? "light" : "dark")}
                accessibilityRole="button"
                accessibilityLabel="Basculer le thème clair/sombre"
                style={{ width: 36, height: 36, borderRadius: RADIUS.pill, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}
              >
                <Feather name={effective === "dark" ? "sun" : "moon"} size={ICON.md} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {(contexte?.titre || contexte?.sousTitre) && (
          <View style={{ paddingHorizontal: S.s16, marginTop: S.s10 }}>
            {contexte.titre ? <Text style={[T.heading, { color: C.text }]}>{contexte.titre}</Text> : null}
            {contexte.sousTitre ? <Text style={[T.small, { color: C.textMuted, marginTop: 3 }]}>{contexte.sousTitre}</Text> : null}
          </View>
        )}

        {filtres != null && (
          <View style={{ paddingHorizontal: S.s16, marginTop: S.s10, gap: S.s6 }}>{filtres}</View>
        )}
      </View>

      {/* Corps : Fil (plein cadre sous l'en-tête) ou Liste (scannable). */}
      <View style={{ flex: 1 }} onLayout={onBodyLayout}>
        {scrutins == null ? (
          <ActivityIndicator color={C.textMuted} style={{ marginTop: 40 }} />
        ) : fil ? (
          <FlatList
              data={data}
              keyExtractor={(s) => s.uid}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              snapToInterval={filH}
              snapToAlignment="start"
              decelerationRate="fast"
              getItemLayout={(_, index) => ({ length: filH, offset: filH * index, index })}
              ListEmptyComponent={
                <View style={{ height: filH, alignItems: "center", justifyContent: "center" }}>
                  <Text style={[T.callout, { color: C.textFaint }]}>{emptyLabel}</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <FilScrutinCard
                  scrutin={item}
                  height={filH}
                  width={filW}
                  ctx={ctx}
                  situe={situe}
                  reponse={item.numero != null ? reponses[item.numero] : undefined}
                  isFirst={index === 0}
                  adaptive
                  annotation={renderAnnotation?.(item)}
                  onDetail={() => onDetail(item.uid)}
                  onShare={() => setShare(item)}
                  onVerdict={ouvrirVerdict}
                />
              )}
            />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: S.s8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {data.length === 0 ? (
              <Text style={[T.callout, { color: C.textFaint, textAlign: "center", marginTop: 40 }]}>{emptyLabel}</Text>
            ) : (
              data.map((s) => (
                <ListeScrutinCard
                  key={s.uid}
                  scrutin={s}
                  ctx={ctx}
                  situe={situe}
                  reponse={s.numero != null ? reponses[s.numero] : undefined}
                  annotation={renderAnnotation?.(s)}
                  onDetail={() => onDetail(s.uid)}
                  onVerdict={ouvrirVerdict}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Overlays partagés : invite à se situer (verdict verrouillé), légende, partage. */}
      <OnboardingFil
        visible={onboarding}
        onStart={() => { setOnboarding(false); onSituer?.(); }}
        onClose={() => setOnboarding(false)}
      />
      <LegendeVerdict visible={legende} onClose={() => setLegende(false)} />
      {share && <ScrutinShareSheet scrutin={share} onClose={() => setShare(null)} />}
    </View>
  );
}
