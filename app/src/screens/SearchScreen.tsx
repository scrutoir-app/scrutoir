import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, inputText, RADIUS, shadowCard } from "../theme";
import { getGrandsScrutins, getCategories, getMeta } from "../api";
import type { CategorieRef, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";
import { SearchResultsList } from "../components/SearchResultsList";
import { HeroScrutins } from "../components/HeroScrutins";
import { ThemePicker } from "../components/ThemePicker";
import { ScrutoirLogo } from "../components/brand/ScrutoirLogo";
import { MesSuivis } from "../components/MesSuivis";

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const enRecherche = q.trim().length >= 2;

  return (
    <View style={{ flex: 1 }}>
      {/* Masthead */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <ScrutoirLogo wordHeight={33} color={C.text} accent={C.accent} />
          <TouchableOpacity
            onPress={() => nav.push({ name: "parametres" })}
            accessibilityRole="button"
            accessibilityLabel="Paramètres"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.borderStrong, ...shadowCard }}
          >
            <Feather name="settings" size={18} color={C.accent} />
          </TouchableOpacity>
        </View>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Tes députés votent comment ?
        </Text>
      </View>

      {/* Recherche */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 11, height: 54,
            backgroundColor: C.surface, borderRadius: RADIUS.md, paddingLeft: 8, paddingRight: 15,
            borderWidth: 1, borderColor: C.borderStrong, ...shadowCard,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
            <Feather name="search" size={19} color="#fff" />
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Un sujet, un nom, une loi… ex. logement, santé, agriculture"
            placeholderTextColor={C.textMuted}
            style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
            autoCorrect={false}
          />
        </View>
      </View>

      {!enRecherche ? <Accueil nav={nav} /> : <SearchResultsList q={q} nav={nav} onCorriger={setQ} />}
    </View>
  );
}

function Accueil({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [grands, setGrands] = useState<ScrutinResume[]>([]);
  const [ingestedAt, setIngestedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCategories(), getGrandsScrutins()])
      .then(([c, g]) => { setCats(c); setGrands(g); })
      .finally(() => setLoading(false));
    // Fraîcheur des données (non bloquant) : date réelle de régénération (version.json).
    getMeta().then((m) => setIngestedAt(m.ingestedAt)).catch(() => setIngestedAt(null));
  }, []);

  if (loading)
    return (
      <View style={{ paddingTop: 40 }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      {/* 2. Derniers grands scrutins (hero + Tout voir) */}
      <View style={{ paddingHorizontal: 18, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 22, marginBottom: 12 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Derniers grands scrutins</Text>
        <TouchableOpacity onPress={() => nav.push({ name: "grandsScrutins" })}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Tout voir ›</Text>
        </TouchableOpacity>
      </View>

      <HeroScrutins
        scrutins={grands.slice(0, 8)}
        ingestedAt={ingestedAt}
        onOpen={(uid) => nav.push({ name: "scrutin", uid })}
      />

      {/* 3. Et toi, tu votes comment ? — entrée du test (carte mise en avant), sous le feed */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "testIntro" })}
        style={{ marginHorizontal: 18, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.accent, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 15, ...shadowCard }}
      >
        <Feather name="help-circle" size={20} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>Et toi, tu votes comment ?</Text>
          <Text style={[T.small, { color: "rgba(255,255,255,0.8)", marginTop: 1 }]}>
            Teste ta proximité avec les groupes
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      {/* 4. Trouver mon député */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "monDepute" })}
        style={{ marginHorizontal: 18, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 15, ...shadowCard }}
      >
        <Feather name="map-pin" size={19} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Trouver mon député</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
            Par département et circonscription
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textFaint} />
      </TouchableOpacity>

      {/* 5. Confronter deux élus (carte blanche standard) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "confrontation" })}
        style={{ marginHorizontal: 18, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 15, ...shadowCard }}
      >
        <Feather name="git-pull-request" size={19} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Confronter deux élus</Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
            Leurs votes côte à côte, accords et désaccords
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textFaint} />
      </TouchableOpacity>

      {/* 6. Explorer par thème */}
      <View style={{ paddingHorizontal: 18 }}>
        <SectionTitle titre="Explorer par thème" />
        <ThemePicker cats={cats} onOpen={(c) => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
      </View>

      <MesSuivis nav={nav} />
    </ScrollView>
  );
}

function SectionTitle({ titre }: { titre: string }) {
  return (
    <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 22, marginBottom: 12 }]}>
      {titre}
    </Text>
  );
}

