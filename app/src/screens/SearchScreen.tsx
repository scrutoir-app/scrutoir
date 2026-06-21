import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { rechercher, getGrandsScrutins, getCategories } from "../api";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";
import { HeroScrutins } from "../components/HeroScrutins";
import { CategoryGrid } from "../components/CategoryGrid";
import { ScrutoirMark } from "../components/ScrutoirMark";

type Item =
  | { kind: "header"; label: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume };

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enRecherche = q.trim().length >= 2;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!enRecherche) {
      setItems([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await rechercher(q.trim());
        const next: Item[] = [];
        if (r.deputes.length) {
          next.push({ kind: "header", label: "Députés" });
          r.deputes.forEach((d) => next.push({ kind: "depute", data: d }));
        }
        if (r.scrutins.length) {
          next.push({ kind: "header", label: "Scrutins" });
          r.scrutins.forEach((s) => next.push({ kind: "scrutin", data: s }));
        }
        setItems(next);
        const hits = r.deputes.length + r.scrutins.length;
        track(hits ? "search" : "search_empty", q.trim().toLowerCase().slice(0, 40));
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, [q]);

  return (
    <View style={{ flex: 1 }}>
      {/* Masthead */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
          <ScrutoirMark size={42} color={C.text} accent={C.accent} />
          <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>Scrutoir</Text>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
          Scrutins publics nominatifs · 17ᵉ législature
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
            placeholder="Rechercher un·e député·e, un parti…"
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, fontSize: 15.5, color: C.text, fontFamily: F.semibold, outlineStyle: "none" } as any}
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color={C.textFaint} />}
        </View>
      </View>

      {!enRecherche ? (
        <Accueil nav={nav} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => (it.kind === "header" ? `h-${it.label}-${i}` : `${it.kind}-${it.data.uid}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 40, fontFamily: F.medium }}>
                Aucun résultat pour « {q.trim()} »
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === "header") return <SectionLabel label={item.label} />;
            if (item.kind === "depute") return <DeputeRow d={item.data} onPress={() => nav.push({ name: "depute", uid: item.data.uid })} />;
            return (
              <View style={{ marginBottom: 10 }}>
                <ScrutinCard scrutin={item.data} onPress={() => nav.push({ name: "scrutin", uid: item.data.uid })} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function Accueil({ nav }: { nav: Nav }) {
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [grands, setGrands] = useState<ScrutinResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCategories(), getGrandsScrutins()])
      .then(([c, g]) => { setCats(c); setGrands(g); })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <View style={{ paddingTop: 40 }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "confrontation" })}
        style={{ marginHorizontal: 18, marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.accent, borderRadius: RADIUS.md, paddingVertical: 13, paddingHorizontal: 15, ...shadowCard }}
      >
        <Feather name="git-pull-request" size={20} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 14.5, color: "#fff" }}>Confronter deux élu·e·s</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: "rgba(255,255,255,0.8)", marginTop: 1 }}>
            Leurs votes côte à côte, accords et désaccords
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => nav.push({ name: "monDepute" })}
        style={{ marginHorizontal: 18, marginTop: 9, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 15, ...shadowCard }}
      >
        <Feather name="map-pin" size={19} color={C.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>Trouver mon·ma député·e</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>
            Par département et circonscription
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color={C.textFaint} />
      </TouchableOpacity>

      <View style={{ paddingHorizontal: 18, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 22, marginBottom: 12 }}>
        <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3 }}>Derniers grands scrutins</Text>
        <TouchableOpacity onPress={() => nav.push({ name: "grandsScrutins" })}>
          <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Tout voir ›</Text>
        </TouchableOpacity>
      </View>

      <HeroScrutins
        scrutins={grands.slice(0, 8)}
        onOpen={(uid) => nav.push({ name: "scrutin", uid })}
      />

      <View style={{ paddingHorizontal: 18 }}>
        <SectionTitle titre="Explorer par thème" />
        <CategoryGrid cats={cats} onOpen={(c) => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
      </View>
    </ScrollView>
  );
}

function SectionTitle({ titre }: { titre: string }) {
  return (
    <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3, marginTop: 22, marginBottom: 12 }}>
      {titre}
    </Text>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.textMuted, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
      {label}
    </Text>
  );
}

function DeputeRow({ d, onPress }: { d: DeputeResume; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 11, marginBottom: 9, ...shadowCard }}
    >
      <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{d.nom_complet}</Text>
        <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 1 }}>{d.abrev ?? "—"}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={C.textFaint} />
    </TouchableOpacity>
  );
}
