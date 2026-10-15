import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, tnum } from "../theme";
import { Chip } from "./ui";
import { catUI } from "../categoryUI";
import { VoteBarDivergenteCentree } from "./VoteBarDivergenteCentree";
import { resumeScrutins, libelleOntCompte, type Statut } from "../textes";
import type { TexteFil } from "../hebdo";
import type { CategorieRef } from "../types";

// Briques partagées par l'onglet Scrutins (Recherche, Textes) et la page d'un texte.
// Maquettes validées le 15/10/2026 : `maquette-onglet-scrutins-recherche-textes.html`,
// `maquette-page-texte-style-du-jour.html`. Tokens de `theme.ts` seulement, sans capitales.

/** Teintes, icône et nom du thème d'un texte ; neutre (« Autres textes ») sans thème. */
export function teinteTexte(theme: string | null) {
  if (theme) {
    const ui = catUI(theme);
    return { bg: ui.bg, fg: ui.fg, icon: ui.icon, nom: ui.court ?? theme };
  }
  return { bg: C.surfaceSunken, fg: C.textMuted, icon: "file-document-outline", nom: "Autres textes" };
}

/** Tuile du thème (icône sur sa teinte douce). */
export function TuileTheme({ theme, size = 34 }: { theme: string | null; size?: number }) {
  const tt = teinteTexte(theme);
  return (
    <View style={{ width: size, height: size, borderRadius: size >= 30 ? RADIUS.sm : 8, backgroundColor: tt.bg, alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name={tt.icon as any} size={size >= 30 ? ICON.base : ICON.xs} color={tt.fg} />
    </View>
  );
}

/** Couleurs d'une issue : vert adopté, rouge rejeté, neutre sans issue. */
export function couleursIssue(sort: "adopte" | "rejete" | null) {
  if (sort === "adopte") return { bg: C.adopteBg, fg: C.adopteFg };
  if (sort === "rejete") return { bg: C.rejeteBg, fg: C.rejeteFg };
  return { bg: C.surfaceSunken, fg: C.textMuted };
}

/** Statut d'un texte en une ligne : pastille « Adopté » + décompte, ou la phrase seule. */
export function StatutLigne({ statut }: { statut: Statut }) {
  if (!statut.sort) return <Text style={[T.small, { color: C.textMuted, marginTop: S.s6 }]}>{statut.label}</Text>;
  const c = couleursIssue(statut.sort);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: S.s8, rowGap: S.s4, marginTop: S.s6 }}>
      <Chip label={statut.label} bg={c.bg} fg={c.fg} radius={7} ph={7} pv={2} />
      <Text style={[T.micro, tnum, { color: C.textMuted }]}>{statut.decompte}</Text>
    </View>
  );
}

/** Séparateur entre deux lignes d'une liste en carte (aligné sur le texte, après la tuile). */
export function Filet({ retrait = 60 }: { retrait?: number }) {
  return <View style={{ height: 1, backgroundColor: C.border, marginLeft: retrait }} />;
}

/**
 * Une ligne « texte » dans une carte : tuile du thème, « Thème · date », titre, statut (vote sur
 * l'ensemble), barre de ce vote (`barre`, résultats de recherche), nombre de scrutins publics et
 * amendements qui ont compté. Toute la ligne ouvre la page du texte.
 */
export function TexteLigne({
  t,
  statut,
  date,
  barre = false,
  note,
  onPress,
}: {
  t: TexteFil;
  statut: Statut;
  date: string;
  barre?: boolean;
  /** Ligne d'appoint sous le résumé (ex. « 3 scrutins citent ce mot »). */
  note?: string | null;
  onPress: () => void;
}) {
  const tt = teinteTexte(t.theme);
  const resume = resumeScrutins(t);
  const compte = libelleOntCompte(t.ontCompte);
  const r = t.reference;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Texte : ${t.titre}. ${statut.label}${statut.decompte ? `, ${statut.decompte}` : ""}`}
      style={{ flexDirection: "row", gap: S.s12, paddingHorizontal: S.s14, paddingVertical: S.s14 }}
    >
      <TuileTheme theme={t.theme} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[T.micro, tnum, { color: C.textFaint }]} numberOfLines={1}>{tt.nom} · {date}</Text>
        <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 2 }]} numberOfLines={2}>{t.titre}</Text>
        <StatutLigne statut={statut} />
        {barre && statut.sort && r && (
          <View style={{ marginTop: S.s8 }}>
            <VoteBarDivergenteCentree pour={r.pour} contre={r.contre} abstention={r.abstention} height={6} />
          </View>
        )}
        {!!resume && <Text style={[T.small, tnum, { color: C.textMuted, marginTop: S.s6 }]}>{resume}</Text>}
        {!!note && <Text style={[T.small, tnum, { color: C.textMuted, marginTop: S.s4 }]}>{note}</Text>}
        {!!compte && <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.accent, marginTop: S.s4 }]}>{compte}</Text>}
      </View>
    </TouchableOpacity>
  );
}

/** Lien plein largeur sous une liste (« Voir les 150 derniers scrutins, un par un › »). */
export function LienListe({ label, onPress, a11y }: { label: string; onPress: () => void; a11y?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={a11y ?? label}
      style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: 48, paddingHorizontal: S.s4, marginTop: S.s8 }}
    >
      <Text style={[T.small, tnum, { flex: 1, fontFamily: F.bold, color: C.text }]}>{label}</Text>
      <Feather name="chevron-right" size={ICON.base} color={C.textMuted} />
    </TouchableOpacity>
  );
}

/** Contrôle segmenté en pilule (sous-onglets) : rôle tablist, l'actif sur fond de carte. */
export function Segments<K extends string>({
  items,
  actif,
  onChange,
  label,
}: {
  items: { key: K; label: string }[];
  actif: K;
  onChange: (k: K) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: "row", alignSelf: "center", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3 }}>
      {items.map((it) => {
        const on = actif === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => onChange(it.key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            style={{ minWidth: 104, height: 38, paddingHorizontal: S.s20, alignItems: "center", justifyContent: "center", borderRadius: RADIUS.pill, backgroundColor: on ? C.surface : "transparent" }}
          >
            <Text style={[T.small, { fontFamily: on ? F.bold : F.semibold, color: on ? C.text : C.textMuted }]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Une puce de filtre (composant stable : pas de remontage, le focus clavier reste). */
function PuceTheme({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Filtrer : ${label}`}
      accessibilityState={{ selected: on }}
      style={{ minHeight: CONTROL.sm, justifyContent: "center", paddingHorizontal: S.s14, borderRadius: RADIUS.pill, backgroundColor: on ? C.accent : C.surface, borderWidth: 1, borderColor: on ? C.accent : C.border }}
    >
      <Text style={[T.small, { fontFamily: F.bold, color: on ? C.onAccent : C.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Filtres par thème en puces défilantes : « Tous les thèmes » puis les thèmes donnés. */
export function PucesThemes({
  cats,
  actif,
  onChange,
  tous = "Tous les thèmes",
  marge = S.s16,
}: {
  cats: CategorieRef[];
  actif: string | null;
  onChange: (id: string | null) => void;
  tous?: string;
  /** Marge latérale du défilement (0 quand le conteneur a déjà la sienne). */
  marge?: number;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: S.s8, paddingHorizontal: marge }}>
      <PuceTheme label={tous} on={actif === null} onPress={() => onChange(null)} />
      {cats.map((c) => <PuceTheme key={c.id} label={catUI(c.id).court ?? c.libelle} on={actif === c.id} onPress={() => onChange(c.id)} />)}
    </ScrollView>
  );
}
