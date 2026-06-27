import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard } from "../theme";
import { rechercher, getCategories } from "../api";
import { dedupParDossier, rechercherSujet } from "../search/fusion";
import { routerIntention } from "../search/intent";
import { motsCles } from "../search/normalize";
import { suggererThemes, type SuggestionTheme } from "../search/suggestions";
import { embedderEstPret } from "../search/embedder";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "./ScrutinCard";

type Item =
  | { kind: "header"; label: string; caption?: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume; motCle?: string }
  | { kind: "sujetLoading"; premier: boolean };

/**
 * Liste de résultats de recherche pour une requête `q` contrôlée par le parent.
 * Rendu EN DEUX TEMPS : les résultats EXACTS (députés/scrutins) s'affichent tout de suite ;
 * la section « Sujet » (sémantique + lexical) s'ajoute quand le moteur a répondu — plus lente
 * au 1er usage (chargement du modèle), silencieusement absente si le modèle est indisponible
 * (repli lexical). `onCorriger` permet de relancer sur la suggestion « Tu voulais dire ».
 */
export function SearchResultsList({
  q,
  nav,
  onCorriger,
}: {
  q: string;
  nav: Nav;
  onCorriger?: (q: string) => void;
}) {
  const [base, setBase] = useState<Item[]>([]); // députés + scrutins exacts
  const [sujet, setSujet] = useState<Item[]>([]); // section « Sujet » (ou ligne de chargement)
  const [correction, setCorrection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    getCategories().then(setCats).catch(() => {});
  }, []);

  const themes: SuggestionTheme[] = suggererThemes(q.trim(), cats);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    setSujet([]);
    const id = ++reqId.current;
    const terme = q.trim();

    // Suggestion « Tu voulais dire » (déterministe, immédiate).
    const sugg = routerIntention(terme).suggestion;
    setCorrection(sugg && sugg !== terme ? sugg : null);

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

      // Phase 2 — section « Sujet » (sémantique + lexical), ajoutée quand prête.
      if (terme.length >= 2) {
        setSujet([{ kind: "sujetLoading", premier: !embedderEstPret() }]);
        try {
          const { sujet: scrs, lexicalUids } = await rechercherSujet(terme, exactScrutins);
          if (id !== reqId.current) return;
          if (scrs.length) {
            const lexSet = new Set(lexicalUids);
            const motCle = motsCles(terme).join(", ");
            const sec: Item[] = [{ kind: "header", label: "Sujet", caption: "Scrutins liés, même sans le mot exact" }];
            scrs.forEach((s) =>
              sec.push({ kind: "scrutin", data: s, motCle: lexSet.has(s.uid) ? motCle : undefined })
            );
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
      ListHeaderComponent={
        correction || themes.length ? (
          <View style={{ paddingTop: 4 }}>
            {correction ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onCorriger?.(correction)}
                disabled={!onCorriger}
                style={{ paddingVertical: 8 }}
              >
                <Text style={[T.small, { color: C.textMuted }]}>
                  Tu voulais dire : <Text style={{ fontFamily: F.bold, color: C.accent }}>{correction}</Text> ?
                </Text>
              </TouchableOpacity>
            ) : null}
            {themes.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 }}>
                {themes.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    activeOpacity={0.7}
                    onPress={() => nav.push({ name: "categorie", id: t.id, libelle: t.libelle })}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 5,
                      backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderStrong,
                      borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, ...shadowCard,
                    }}
                  >
                    <Feather name="grid" size={12} color={C.accent} />
                    <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{t.libelle}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null
      }
      ListEmptyComponent={
        !loading ? (
          <Text style={{ textAlign: "center", color: C.textMuted, marginTop: 40, fontFamily: F.medium }}>
            Rien de probant. Reformule, ou essaie un thème plus large.
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
              <Text style={[T.small, { color: C.textFaint }]}>
                {item.premier ? "Premier lancement de la recherche, patiente deux secondes." : "Recherche par sujet…"}
              </Text>
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
            {item.motCle ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Feather name="file-text" size={11} color={C.textFaint} />
                <Text style={[T.small, { color: C.textFaint }]}>Mentionne « {item.motCle} »</Text>
              </View>
            ) : null}
            <ScrutinCard scrutin={item.data} onPress={() => nav.push({ name: "scrutin", uid: item.data.uid })} />
          </View>
        );
      }}
    />
  );
}
