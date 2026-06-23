import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { rechercher } from "../api";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "./ScrutinCard";

type Item =
  | { kind: "header"; label: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume };

/**
 * Liste de résultats de recherche (députés + scrutins) pour une requête `q` contrôlée
 * par le parent. Recherche débouncée. Sans champ de saisie (le parent gère l'input) —
 * permet une recherche EN LIGNE depuis n'importe quel onglet.
 */
export function SearchResultsList({ q, nav }: { q: string; nav: Nav }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
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
            <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, marginTop: 14, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }]}>
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
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{d.nom_complet}</Text>
                <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>{d.abrev ?? "—"}</Text>
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
  );
}
