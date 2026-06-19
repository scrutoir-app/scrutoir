import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { rechercher, getGrandsScrutins, getCategories } from "../api";
import type { DeputeResume, ScrutinResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";
import { HeroScrutins } from "../components/HeroScrutins";
import { CategoryTile } from "../components/CategoryTile";
import { HemicycleMark } from "../components/HemicycleMark";

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <HemicycleMark size={40} color={C.text} />
          <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>Hémicycle</Text>
        </View>
        <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>
          Ce que votent vraiment les députés
        </Text>
      </View>

      {/* Recherche */}
      <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 9, height: 46,
            backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 15, ...shadowCard,
          }}
        >
          <Feather name="search" size={18} color={C.textFaint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Un·e député·e, un parti, un scrutin…"
            placeholderTextColor={C.textFaint}
            style={{ flex: 1, fontSize: 14.5, color: C.text, fontFamily: F.medium, outlineStyle: "none" } as any}
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 11 }}>
          {cats.map((c) => (
            <View key={c.id} style={{ width: "48.5%" }}>
              <CategoryTile id={c.id} libelle={c.libelle} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
            </View>
          ))}
        </View>
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
