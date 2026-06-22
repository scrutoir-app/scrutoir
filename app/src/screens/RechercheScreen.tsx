import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { rechercher } from "../api";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "../components/ScrutinCard";

type Item =
  | { kind: "header"; label: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume };

/** Recherche plein écran, accessible depuis n'importe quel onglet (route poussée). */
export function RechercheScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const enRecherche = q.trim().length >= 2;

  // Focus auto à l'ouverture (laisse l'écran se monter d'abord).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

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
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
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
            ref={inputRef}
            value={q}
            onChangeText={setQ}
            placeholder="Rechercher député, parti, scrutin"
            placeholderTextColor={C.textMuted}
            style={{ flex: 1, fontSize: 16, color: C.text, fontFamily: F.medium, outlineStyle: "none" } as any}
            autoCorrect={false}
          />
          {loading && <ActivityIndicator size="small" color={C.textFaint} />}
        </View>
      </View>

      {!enRecherche ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, textAlign: "center", lineHeight: 19 }}>
            Tapez au moins 2 lettres pour chercher un député, un parti ou un scrutin.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, i) => (it.kind === "header" ? `h-${it.label}-${i}` : `${it.kind}-${it.data.uid}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 }}
          ListEmptyComponent={
            !loading ? (
              <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 40, fontFamily: F.medium }}>
                Aucun résultat pour « {q.trim()} »
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.kind === "header")
              return (
                <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.textMuted, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {item.label}
                </Text>
              );
            if (item.kind === "depute") {
              const d = item.data;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => nav.push({ name: "depute", uid: d.uid })}
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
