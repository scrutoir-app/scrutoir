import React, { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, shadowCard } from "../theme";
import { Card, Button } from "./ui";
import { rechercher, getCategories } from "../api";
import { dedupParDossier, rechercherSujet } from "../search/fusion";
import { routerIntention } from "../search/intent";
import { motsCles } from "../search/normalize";
import { suggererThemes, type SuggestionTheme } from "../search/suggestions";
import { embedderEstPret } from "../search/embedder";
import { semantiqueAutorisee, autoriserSemantique, modeleDejaEnCache, stockageSuffisant } from "../search/consent";
import { track } from "../analytics";
import type { DeputeResume, ScrutinResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import { ScrutinCard } from "./ScrutinCard";

type Item =
  | { kind: "header"; label: string; caption?: string }
  | { kind: "depute"; data: DeputeResume }
  | { kind: "scrutin"; data: ScrutinResume; motCle?: string }
  | { kind: "sujetLoading"; premier: boolean }
  | { kind: "sujetOptin" };

const MO = (n: number) => Math.max(1, Math.round(n / 1048576));

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
  // Consentement au modèle sémantique (~120 Mo) : null = vérification du cache en cours.
  const [semActive, setSemActive] = useState<boolean | null>(null);
  const [stockKo, setStockKo] = useState(false);
  // Progression du téléchargement du modèle, annoncée par le SW (scrutoir:model-progress).
  const [progres, setProgres] = useState<{ loaded: number; total: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    getCategories().then(setCats).catch(() => {});
  }, []);

  // Opt-in déjà donné, ou modèle déjà en cache (rien à télécharger) → sémantique active.
  useEffect(() => {
    if (semantiqueAutorisee()) {
      setSemActive(true);
      return;
    }
    let vivant = true;
    modeleDejaEnCache().then((ok) => vivant && setSemActive(ok));
    return () => {
      vivant = false;
    };
  }, []);

  // Écoute la progression du téléchargement du modèle (messages du service worker).
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw) return;
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d && d.type === "scrutoir:model-progress") setProgres({ loaded: d.loaded, total: d.total });
    };
    sw.addEventListener("message", onMsg);
    return () => sw.removeEventListener("message", onMsg);
  }, []);

  // Activation par l'utilisateur : vérifie la place disponible, mémorise l'opt-in
  // (+ demande la persistance du storage), puis relance la recherche avec le modèle.
  const activerSujet = async () => {
    if (!(await stockageSuffisant())) {
      setStockKo(true);
      return;
    }
    await autoriserSemantique();
    setSemActive(true);
  };

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
      // Sans opt-in au modèle (~120 Mo, cf. search/consent.ts) : repli lexical seul
      // + carte « Activer » — on ne déclenche JAMAIS le téléchargement à l'insu de
      // l'utilisateur (forfait mobile). L'activation relance l'effet (dep `semActive`).
      if (terme.length >= 2) {
        const avecModele = semActive === true;
        setSujet(avecModele ? [{ kind: "sujetLoading", premier: !embedderEstPret() }] : []);
        try {
          const { sujet: scrs, lexicalUids } = await rechercherSujet(terme, exactScrutins, {
            sansModele: !avecModele,
          });
          if (id !== reqId.current) return;
          const proposerOptin = !avecModele && routerIntention(terme).type === "sujet";
          const sec: Item[] = [];
          if (scrs.length) {
            const lexSet = new Set(lexicalUids);
            const motCle = motsCles(terme).join(", ");
            sec.push({ kind: "header", label: "Sujet", caption: "Scrutins liés, même sans le mot exact" });
            scrs.forEach((s) =>
              sec.push({ kind: "scrutin", data: s, motCle: lexSet.has(s.uid) ? motCle : undefined })
            );
          }
          if (proposerOptin) sec.push({ kind: "sujetOptin" });
          setSujet(sec);
        } catch {
          if (id === reqId.current) setSujet([]);
        }
      }
    }, 250);
  }, [q, semActive]);

  const items = [...base, ...sujet];

  return (
    <FlatList
      data={items}
      keyExtractor={(it, i) =>
        it.kind === "header" ? `h-${it.label}-${i}`
        : it.kind === "sujetLoading" ? `sl-${i}`
        : it.kind === "sujetOptin" ? `so-${i}`
        : `${it.kind}-${it.data.uid}-${i}`
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
              <Text style={[T.small, { color: C.textMuted }]}>
                {!item.premier
                  ? "Recherche par sujet…"
                  : progres && progres.loaded < progres.total
                    ? `Téléchargement du modèle… ${MO(progres.loaded)} / ${MO(progres.total)} Mo`
                    : "Préparation de la recherche par sujet (une seule fois)…"}
              </Text>
            </View>
          );
        if (item.kind === "sujetOptin")
          return (
            <Card
              style={{
                marginTop: 16,
                borderWidth: 1, borderColor: C.borderStrong,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Feather name="compass" size={15} color={C.accent} />
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>Recherche par sujet</Text>
              </View>
              <Text style={[T.small, { color: C.textMuted, marginTop: 6 }]}>
                Trouve les scrutins liés à ton sujet, même sans le mot exact. Nécessite le
                téléchargement d'un modèle d'environ 120 Mo — une seule fois, Wi-Fi conseillé.
              </Text>
              {stockKo ? (
                <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: 10 }]}>
                  Espace de stockage insuffisant sur cet appareil (~300 Mo nécessaires).
                </Text>
              ) : (
                <Button
                  label="Activer"
                  onPress={activerSujet}
                  variant="primary"
                  size="sm"
                  accessibilityLabel="Activer la recherche par sujet (téléchargement d'environ 120 mégaoctets)"
                  style={{ alignSelf: "flex-start", marginTop: 11 }}
                />
              )}
            </Card>
          );
        if (item.kind === "depute") {
          const d = item.data;
          return (
            <Card
              onPress={() => nav.push({ name: "depute", uid: d.uid })}
              padding={11}
              accessibilityLabel={`Voir la fiche de ${d.nom_complet}${d.abrev ? `, ${d.abrev}` : ""}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 }}
            >
              <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
              <View style={{ flex: 1 }}>
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{d.nom_complet}</Text>
                <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>{d.abrev ?? "—"}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={C.textFaint} />
            </Card>
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
