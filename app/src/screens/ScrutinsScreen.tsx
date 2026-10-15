import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, shadowCard } from "../theme";
import { Card, Button } from "../components/ui";
import { Segments, TexteLigne, Filet, LienListe, PucesThemes } from "../components/texteUI";
import { RechercheTextes } from "../components/RechercheTextes";
import { ErreurChargement } from "../components/ErreurChargement";
import { getIndexTextes, getCategories } from "../api";
import { useData } from "../hooks/useData";
import { statutCarte, dateCourte } from "../textes";
import { trierTextes, aujourdhuiParis, type IndexTextes, type TexteFil, type TriTextes } from "../hebdo";
import type { CategorieRef } from "../types";
import type { Nav } from "../nav";

// Onglet Scrutins (clé de route historique « themes »). Maquette validée le 15/10/2026
// (`maquette-onglet-scrutins-recherche-textes.html`) : deux sous-onglets, « Recherche » PAR DÉFAUT
// (la barre seule, résultats regroupés par texte) et « Textes » (les textes votés récemment, un
// texte par carte, au format validé le 14/10). Le Fil immersif sort de l'onglet : il reste derrière
// « Voir les 150 derniers scrutins, un par un » (écran `scrutinsListe`, bascule Fil | Liste).

type Onglet = "recherche" | "textes";
const NB_TEXTES = 30; // textes affichés, puis par tranches de 30
const NB_SCRUTINS_UN_PAR_UN = 150;

// Mémoire de SESSION de l'onglet : App ne rend que l'écran au sommet de la pile, l'état local se
// perdrait en ouvrant un texte. En mémoire seulement (rien sur l'appareil, rien sur le réseau).
const memoire: { onglet: Onglet; q: string; tri: TriTextes; theme: string | null; n: number } = {
  onglet: "recherche",
  q: "",
  tri: "recent",
  theme: null,
  n: NB_TEXTES,
};

export function ScrutinsScreen({ nav }: { nav: Nav }) {
  const { data: index, error, retry } = useData(() => getIndexTextes(), []);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  useEffect(() => {
    getCategories().then(setCats).catch(() => setCats([]));
  }, []);

  const [onglet, setOnglet] = useState<Onglet>(memoire.onglet);
  const [q, setQ] = useState(memoire.q);
  const [tri, setTri] = useState<TriTextes>(memoire.tri);
  const [theme, setTheme] = useState<string | null>(memoire.theme);
  const [n, setN] = useState(memoire.n);
  useEffect(() => {
    Object.assign(memoire, { onglet, q, tri, theme, n });
  }, [onglet, q, tri, theme, n]);

  // En recherche, les sous-onglets s'effacent : la barre monte en haut (maquette, écran A2).
  const enRecherche = onglet === "recherche" && !!q.trim();

  return (
    <View style={{ flex: 1 }}>
      {!enRecherche && (
        <View style={{ paddingTop: S.s12, paddingBottom: S.s4 }}>
          <Segments
            label="Onglet Scrutins"
            items={[{ key: "recherche", label: "Recherche" }, { key: "textes", label: "Textes" }]}
            actif={onglet}
            onChange={setOnglet}
          />
        </View>
      )}
      {onglet === "recherche" ? (
        <RechercheTextes q={q} onQ={setQ} index={index} erreur={!!error} onRetry={retry} cats={cats} nav={nav} />
      ) : (
        <ListeTextes
          index={index}
          erreur={!!error}
          onRetry={retry}
          cats={cats}
          tri={tri}
          onTri={setTri}
          theme={theme}
          onTheme={(t) => { setTheme(t); setN(NB_TEXTES); }}
          n={n}
          onPlus={() => setN((x) => x + NB_TEXTES)}
          nav={nav}
        />
      )}
    </View>
  );
}

const LIBELLE_TRI: Record<TriTextes, string> = { recent: "Plus récents", poids: "Plus importants" };

/** Sous-onglet « Textes » : filtres par thème, tri au choix, un texte par ligne. */
function ListeTextes({
  index, erreur, onRetry, cats, tri, onTri, theme, onTheme, n, onPlus, nav,
}: {
  index: IndexTextes | null;
  erreur: boolean;
  onRetry: () => void;
  cats: CategorieRef[];
  tri: TriTextes;
  onTri: (t: TriTextes) => void;
  theme: string | null;
  onTheme: (t: string | null) => void;
  n: number;
  onPlus: () => void;
  nav: Nav;
}) {
  const [menuTri, setMenuTri] = useState(false);
  const annee = aujourdhuiParis().slice(0, 4);
  const auj = aujourdhuiParis();

  // Thèmes présents parmi les textes récents (pas de filtre vide), dans l'ordre des thèmes.
  const themes = useMemo(() => {
    const ids = new Set<string>();
    (index?.textes ?? []).slice(0, NB_TEXTES).forEach((t) => t.cats.forEach((c) => ids.add(c)));
    if (theme) ids.add(theme);
    return cats.filter((c) => ids.has(c.id));
  }, [index, cats, theme]);

  // Les n textes les plus récents (du thème choisi), triés au choix. « Plus importants » = poids
  // de la semaine à l'Assemblée (volume, scrutin solennel, vote sur l'ensemble, censure).
  const { liste, reste } = useMemo(() => {
    const du = (index?.textes ?? []).filter((t) => !theme || t.cats.includes(theme));
    return { liste: trierTextes(du.slice(0, n), tri), reste: Math.max(0, du.length - n) };
  }, [index, theme, n, tri]);

  if (!index) {
    return erreur ? <ErreurChargement onRetry={onRetry} /> : <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s40 }} />;
  }

  const ouvrir = (t: TexteFil) => nav.push({ name: "dossierScrutins", ref: t.cle, titre: t.titre });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: S.s40 }}>
      <View style={{ paddingTop: S.s10 }}>
        <PucesThemes cats={themes} actif={theme} onChange={onTheme} />
      </View>

      <View style={{ paddingHorizontal: S.s16 }}>
        {/* En-tête + menu de tri (au-dessus de la liste : zIndex pour passer devant la carte). */}
        <View style={{ zIndex: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: S.s20, marginBottom: S.s10 }}>
            <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Textes votés récemment</Text>
            <TouchableOpacity
              onPress={() => setMenuTri((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`Trier : ${LIBELLE_TRI[tri].toLowerCase()}. Changer le tri`}
              aria-expanded={menuTri}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ flexDirection: "row", alignItems: "center", gap: S.s4, minHeight: CONTROL.sm }}
            >
              <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{LIBELLE_TRI[tri]}</Text>
              <Feather name={menuTri ? "chevron-up" : "chevron-down"} size={ICON.sm} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          {menuTri && (
            <View
              accessibilityRole="menu"
              style={{ position: "absolute", top: 46, right: 0, width: 264, backgroundColor: C.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, paddingVertical: S.s4, ...shadowCard }}
            >
              {(["recent", "poids"] as TriTextes[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  onPress={() => { onTri(k); setMenuTri(false); }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: tri === k }}
                  style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: CONTROL.md, paddingHorizontal: S.s14 }}
                >
                  <Text style={[T.small, { flex: 1, fontFamily: tri === k ? F.bold : F.medium, color: C.text }]}>{LIBELLE_TRI[k]}</Text>
                  {tri === k && <Feather name="check" size={ICON.sm} color={C.accent} />}
                </TouchableOpacity>
              ))}
              <Text style={[T.micro, { color: C.textFaint, paddingHorizontal: S.s14, paddingTop: S.s4, paddingBottom: S.s8 }]}>
                Importance : nombre de scrutins publics, plus un bonus pour un scrutin solennel, un vote sur l'ensemble ou une censure.
              </Text>
            </View>
          )}
        </View>

        {liste.length === 0 ? (
          <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: S.s24 }]}>Aucun texte sur ce thème.</Text>
        ) : (
          <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
            {liste.map((t, i) => (
              <View key={t.cle}>
                {i > 0 && <Filet />}
                <TexteLigne t={t} statut={statutCarte(t, auj)} date={dateCourte(t.derniereDate, annee)} onPress={() => ouvrir(t)} />
              </View>
            ))}
          </Card>
        )}
        {reste > 0 && (
          <Button label="Afficher plus de textes" variant="text" size="sm" onPress={onPlus} style={{ alignSelf: "flex-start", marginTop: S.s4 }} />
        )}
        <LienListe
          label={`Voir les ${NB_SCRUTINS_UN_PAR_UN} derniers scrutins, un par un`}
          onPress={() => nav.push({ name: "scrutinsListe" })}
        />
      </View>
    </ScrollView>
  );
}
