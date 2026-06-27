import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { rechercher } from "../api";
import { dedupParDossier, rechercherSujet } from "../search/fusion";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "./ScrutinCard";

type Item =
  | { kind: "header"; label: string; caption?: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume }
  | { kind: "sujetLoading" };

/**
 * Liste de résultats de recherche pour une requête `q` contrôlée par le parent.
 * Rendu EN DEUX TEMPS : les résultats EXACTS (députés/scrutins) s'affichent tout de suite ;
 * la section « Sujet » (recherche sémantique) s'ajoute quand le modèle a répondu — elle peut
 * être plus lente au 1er usage (chargement du modèle) et est silencieusement absente si le
 * modèle est indisponible (repli lexical). Recherche débouncée.
 */
export function SearchResultsList({ q, nav }: { q: string; nav: Nav }) {
  const [base, setBase] = useState<Item[]>([]); // députés + scrutins exacts
  const [sujet, setSujet] = useState<Item[]>([]); // section « Sujet » (ou ligne de chargement)
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    setSujet([]);
    const id = ++reqId.current;
    const terme = q.trim();

    timer.current = setTimeout(async () => {
      // Phase 1 — exact (instantané).
      let exactScrutins: ScrutinResume[] = [];
      try {
        const r = await rechercher(terme);
        if (id !== reqId.current) return; // requête périmée
        exactScrutins = r.scrutins;
        const scrutins = dedupParDossier(r.scrutins);
        const next: Item[] = [];
        if (r.deputes.length) {
          next.push({ kind: "header", label: "Députés" });
          r.deputes.forEach((d) => next.push({ kind: "depute", data: d }));
        }
        if (scrutins.length) {
          next.push({ kind: "header", label: "Scrutins" });
          scrutins.forEach((s) => next.push({ kind: "scrutin", data: s }));
        }
        setBase(next);
        track(r.deputes.length + scrutins.length ? "search" : "search_empty", terme.toLowerCase().slice(0, 40));
      } catch {
        if (id !== reqId.current) return;
        setBase([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }

      // Phase 2 — section « Sujet » (sémantique), ajoutée quand prête.
      if (terme.length >= 2) {
        setSujet([{ kind: "sujetLoading" }]);
        try {
          const { sujet: scrs } = await rechercherSujet(terme, exactScrutins);
          if (id !== reqId.current) return;
          if (scrs.length) {
            const sec: Item[] = [{ kind: "header", label: "Sujet", caption: "Scrutins liés, même sans le mot exact" }];
            scrs.forEach((s) => sec.push({ kind: "scrutin", data: s }));
            setSujet(sec);
          } else {
            setSujet([]);
          }
        } catch {
          if (id === reqId.current) setSujet([]);
        }
      }
    }, 250);
  }, [q]);

  const items = [...base, ...sujet];

  return (
    <FlatList
      data={items}
      keyExtractor={(it, i) =>
        it.kind === "header" ? `h-${it.label}-${i}` : it.kind === "sujetLoading" ? `sl-${i}` : `${it.kind}-${it.data.uid}-${i}`
      }
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
            <View style={{ marginTop: 14, marginBottom: 8 }}>
              <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }]}>
                {item.label}
              </Text>
              {item.caption ? (
                <Text style={[T.small, { color: C.textFaint, marginTop: 2 }]}>{item.caption}</Text>
              ) : null}
            </View>
          );
        if (item.kind === "sujetLoading")
          return (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, marginBottom: 4 }}>
              <ActivityIndicator size="small" color={C.textFaint} />
              <Text style={[T.small, { color: C.textFaint }]}>Recherche par sujet…</Text>
            </View>
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
