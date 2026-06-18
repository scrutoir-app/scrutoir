import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from "react-native";
import { C, formatDate } from "../theme";
import { rechercher } from "../api";
import type { DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";

type Item =
  | { kind: "header"; label: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume };

export function SearchScreen({ nav }: { nav: Nav }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    setTouched(true);
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
        <Text style={{ fontSize: 22, fontWeight: "500", color: C.text, marginBottom: 12 }}>
          Le vote réel des députés
        </Text>
        <View
          style={{
            flexDirection: "row", alignItems: "center", gap: 8, height: 44,
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

      {touched && !loading && items.length === 0 && q.trim().length >= 2 && (
        <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 32 }}>
          Aucun résultat pour « {q.trim()} »
        </Text>
      )}

      <FlatList
        data={items}
        keyExtractor={(it, i) =>
          it.kind === "header" ? `h-${it.label}-${i}` : `${it.kind}-${it.data.uid}`
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        renderItem={({ item }) => {
          if (item.kind === "header")
            return (
              <Text
                style={{
                  fontSize: 12, color: C.textMuted, fontWeight: "500",
                  marginTop: 18, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
                }}
              >
                {item.label}
              </Text>
            );
          if (item.kind === "depute") {
            const d = item.data;
            return (
              <TouchableOpacity
                onPress={() => nav.push("depute", { uid: d.uid })}
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
          const s = item.data;
          return (
            <TouchableOpacity
              onPress={() => nav.push("scrutin", { uid: s.uid })}
              style={{ paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: C.border }}
            >
              <Text style={{ fontSize: 14, color: C.text }} numberOfLines={2}>
                {s.titre || s.objet}
              </Text>
              <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>
                {formatDate(s.date)} · {s.sort_libelle}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
