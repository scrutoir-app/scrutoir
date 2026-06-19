import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, Image, ImageBackground, FlatList,
  LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent, useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate } from "../theme";
import { catUI, catPhoto } from "../categoryUI";
import type { ScrutinResume } from "../types";

const GAP = 12;
const SIDE = 18; // marge écran (alignée sur le contenu de l'accueil)

/** Type de texte court (« kicker ») dérivé du libellé / type de vote. */
function kicker(s: ScrutinResume): string {
  const tv = (s.type_vote ?? "").toLowerCase();
  if (tv.includes("motion de censure")) return "Motion de censure";
  const t = (s.titre ?? "").toLowerCase();
  if (t.includes("proposition de loi")) return "Proposition de loi";
  if (t.includes("projet de loi")) return "Projet de loi";
  return "Scrutin solennel";
}

const SHADOW_TEXT = {
  textShadowColor: "rgba(0,0,0,0.45)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
} as const;

/** Carte « hero » d'un grand scrutin : photo de fond par thème + voile sombre + texte blanc. */
function HeroCard({ s, width, onPress }: { s: ScrutinResume; width: number; onPress: () => void }) {
  const adopte = s.sort_code === "adopte";
  const p = s.pour ?? 0, c = s.contre ?? 0, a = s.abstention ?? 0;
  const tot = p + c + a;
  const ui = s.categorie ? catUI(s.categorie) : catUI("");
  const photo = catPhoto(s.categorie ?? "", s.uid);
  const seg = (v: number, col: string) =>
    v ? <View key={col} style={{ flex: v / (tot || 1), backgroundColor: col }} /> : null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{ width, height: 210, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: ui.bg, ...shadowCard }}
    >
      <ImageBackground
        source={photo ? { uri: photo } : undefined}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        {/* Voile sombre (lisibilité du texte blanc) — plus dense en bas */}
        <View style={{ ...StyleSheetAbsolute, backgroundColor: "rgba(18,22,30,0.34)" }} />
        <View style={{ ...StyleSheetAbsolute, top: "45%", backgroundColor: "rgba(12,15,22,0.5)" }} />

        <View style={{ flex: 1, padding: 16, justifyContent: "space-between" }}>
          {/* En-tête : chip catégorie (ou photo porteur) + kicker/date + résultat */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {s.porteur_photo ? (
              <Image source={{ uri: s.porteur_photo }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }} />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name={ui.icon as any} size={19} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: "#fff", letterSpacing: 0.2, ...SHADOW_TEXT }} numberOfLines={1}>
                {s.porteur_nom ?? kicker(s)}
              </Text>
              <Text style={{ fontFamily: F.semibold, fontSize: 11.5, color: "rgba(255,255,255,0.85)", marginTop: 1, ...SHADOW_TEXT }}>
                {s.porteur_nom ? kicker(s) + " · " : ""}{formatDate(s.date)}
              </Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: adopte ? C.adopteFg : C.rejeteFg }}>
              <Text style={{ fontFamily: F.bold, fontSize: 11, color: "#fff" }}>
                {adopte ? "Adopté" : "Rejeté"}
              </Text>
            </View>
          </View>

          {/* Bas : titre + répartition des votes */}
          <View>
            <Text style={{ fontFamily: F.semibold, fontSize: 16.5, color: "#fff", lineHeight: 21, letterSpacing: -0.3, ...SHADOW_TEXT }} numberOfLines={2}>
              {s.titre || s.objet}
            </Text>
            {tot > 0 && (
              <View style={{ marginTop: 11 }}>
                <View style={{ flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.25)" }}>
                  {seg(p, C.pour)}
                  {seg(c, C.contre)}
                  {seg(a, C.abstention)}
                </View>
                <Text style={{ fontFamily: F.semibold, fontSize: 11.5, color: "rgba(255,255,255,0.92)", marginTop: 6, ...SHADOW_TEXT }}>
                  {p} pour · {c} contre · {a} abst.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const StyleSheetAbsolute = { position: "absolute" as const, left: 0, right: 0, top: 0, bottom: 0 };

/** Carrousel horizontal swipeable des derniers grands scrutins. */
export function HeroScrutins({
  scrutins, onOpen,
}: {
  scrutins: ScrutinResume[];
  onOpen: (uid: string) => void;
}) {
  // Largeur réelle du conteneur (mesurée) — pas la fenêtre, qui peut différer du
  // contenu centré/contraint. Garantit l'alignement sur les autres composants.
  // `winW` sert uniquement de signal : on remonte le conteneur (via key) à chaque
  // changement de largeur de fenêtre pour forcer une remesure (resize web à chaud).
  const { width: winW } = useWindowDimensions();
  const [boxW, setBoxW] = useState(0);
  const [index, setIndex] = useState(0);
  const cardW = boxW - SIDE * 2; // aligné sur la largeur des autres composants
  const interval = cardW + GAP;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / interval);
    if (i !== index) setIndex(i);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== boxW) setBoxW(w);
  };

  if (boxW <= 0) return <View key={winW} onLayout={onLayout} style={{ height: 1 }} />;

  return (
    <View key={winW} onLayout={onLayout}>
      <FlatList
        data={scrutins}
        keyExtractor={(s) => s.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={interval}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <HeroCard s={item} width={cardW} onPress={() => onOpen(item.uid)} />
        )}
      />

      {/* Pagination (points) */}
      {scrutins.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 11 }}>
          {scrutins.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? C.accent : C.borderStrong,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
