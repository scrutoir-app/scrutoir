import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView,
} from "react-native";
import { C } from "../theme";
import { rechercher, getGrandsScrutins, getCategories } from "../api";
import type { DeputeResume, ScrutinResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import { ScrutinRow } from "../components/ScrutinRow";

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
    <View style={{ flex: 1, paddingTop: 8 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "500", color: C.text }}>
            Le vote réel des députés
          </Text>
          <TouchableOpacity onPress={() => nav.push({ name: "apropos" })} style={{ padding: 4 }}>
            <Text style={{ fontSize: 13, color: C.accent }}>ⓘ Infos</Text>
          </TouchableOpacity>
        </View>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 8, height: 44, marginTop: 12,
            borderWidth: 1, borderColor: C.border, borderRadius: 22,
            paddingHorizontal: 16, backgroundColor: C.surface,
          }}
        >
          <Text style={{ fontSize: 16, color: C.textFaint }}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Un·e député·e ou un scrutin…"
            placeholderTextColor={C.textFaint}
            style={{ flex: 1, fontSize: 15, color: C.text, outlineStyle: "none" } as any}
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
          keyExtractor={(it, i) =>
            it.kind === "header" ? `h-${it.label}-${i}` : `${it.kind}-${it.data.uid}`
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
                Aucun résultat pour « {q.trim()} »
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === "header")
              return <SectionLabel label={item.label} />;
            if (item.kind === "depute")
              return <DeputeRow d={item.data} onPress={() => nav.push({ name: "depute", uid: item.data.uid })} />;
            return <ScrutinRow scrutin={item.data} onPress={() => nav.push({ name: "scrutin", uid: item.data.uid })} />;
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
      .then(([c, g]) => {
        setCats(c);
        setGrands(g);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <View style={{ paddingTop: 40 }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
      <SectionLabel label="Parcourir par thème" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, marginBottom: 8 }}>
        {cats.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })}
            style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18,
              borderWidth: 0.5, borderColor: C.border, backgroundColor: C.surface,
            }}
          >
            <Text style={{ fontSize: 13 }}>{c.emoji}</Text>
            <Text style={{ fontSize: 13, color: C.text }}>{c.libelle}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionLabel label="Derniers grands scrutins" />
      {grands.map((s) => (
        <ScrutinRow key={s.uid} scrutin={s} onPress={() => nav.push({ name: "scrutin", uid: s.uid })} />
      ))}
    </ScrollView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 12, color: C.textMuted, fontWeight: "500",
        marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
      }}
    >
      {label}
    </Text>
  );
}

function DeputeRow({ d, onPress }: { d: DeputeResume; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}
    >
      <Image
        source={{ uri: d.photo_url ?? undefined }}
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.surfaceAlt }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.text }}>{d.nom_complet}</Text>
        <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{d.abrev ?? "—"}</Text>
      </View>
      <Text style={{ color: C.textFaint, fontSize: 18 }}>›</Text>
    </TouchableOpacity>
  );
}
