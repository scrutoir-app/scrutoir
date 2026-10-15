import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL } from "../theme";
import { APP_VERSION } from "../config";
import { Card } from "../components/ui";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { INFOS_TITRE, EN_BREF, FAMILLES_INFOS, type FamilleInfos, type BlocInfos } from "../content/infos";
import type { Nav } from "../nav";

// Interligne des paragraphes longs (cran `small`, aéré pour la lecture).
const LIGNE = 18;

// Niveau de titre (h2, h3) : RN ne type pas `aria-level`, react-native-web le lit.
const niveau = (n: 2 | 3) => ({ "aria-level": n }) as object;

// Espaces insécables à l'affichage : un guillemet ne reste plus seul en bout de ligne.
const insecables = (t: string) => t.replace(/« /g, "«\u00A0").replace(/ »/g, "\u00A0»");

/** « En bref » : les trois points à retenir, avant tout détail. */
function EnBref() {
  return (
    <Card radius={RADIUS.lg}>
      <Text accessibilityRole="header" {...niveau(2)} style={[T.callout, { fontFamily: F.bold, color: C.text }]}>En bref</Text>
      {EN_BREF.map((p) => (
        <View key={p.icone} style={{ flexDirection: "row", alignItems: "flex-start", gap: S.s10, marginTop: S.s10 }}>
          <View style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: C.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
            <Feather name={p.icone} size={ICON.sm} color={C.accent} />
          </View>
          <Text style={[T.small, { flex: 1, lineHeight: LIGNE, color: C.text, paddingTop: 5 }]}>{p.texte}</Text>
        </View>
      ))}
    </Card>
  );
}

/**
 * Mini-schéma de la barre de vote : la vraie barre des fiches scrutin, avec des valeurs
 * d'illustration, puis la légende du sens de lecture. Un seul élément pour un lecteur d'écran
 * (les valeurs d'illustration ne sont pas lues).
 */
function SchemaBarre() {
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Schéma de la barre de vote : le pour à gauche, l'abstention au centre, le contre à droite"
      style={{ marginTop: S.s10 }}
    >
      <View importantForAccessibility="no-hide-descendants" aria-hidden>
        <VoteBarDivergenteCentree pour={179} contre={98} abstention={45} height={12} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.adopteFg }]}>← pour</Text>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>abstention au centre</Text>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.rejeteFg }]}>contre →</Text>
        </View>
      </View>
    </View>
  );
}

function Bloc({ bloc, premier }: { bloc: BlocInfos; premier: boolean }) {
  const titre = <Text accessibilityRole="header" {...niveau(3)} style={[T.small, { fontFamily: F.bold, color: C.text }]}>{insecables(bloc.titre)}</Text>;
  const texte = (
    <Text style={[T.small, { lineHeight: LIGNE, color: bloc.schemaBarre ? C.text : C.textMuted, marginTop: bloc.schemaBarre ? S.s8 : S.s4 }]}>
      {insecables(bloc.texte)}
    </Text>
  );
  // Le bloc de la barre de vote est posé dans un encart, avec son schéma (cf. maquette).
  if (bloc.schemaBarre) {
    return (
      <View style={{ marginTop: premier ? 0 : S.s14, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.md, padding: S.s12 }}>
        {titre}
        <SchemaBarre />
        {texte}
      </View>
    );
  }
  return (
    <View style={{ marginTop: premier ? 0 : S.s16 }}>
      {titre}
      {texte}
    </View>
  );
}

/**
 * Une famille repliable : en-tête (titre + sous-titre + chevron), blocs affichés une fois dépliée.
 * Motif d'accordéon WAI-ARIA : le bouton (état déplié annoncé) est posé dans un titre de niveau 2.
 */
function Famille({ famille, premiere }: { famille: FamilleInfos; premiere: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <View>
      {!premiere && <View style={{ height: 1, backgroundColor: C.border, marginLeft: S.s14 }} />}
      <View accessibilityRole="header" {...niveau(2)}>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => setOuvert((o) => !o)}
          accessibilityRole="button"
          aria-expanded={ouvert}
          style={{ flexDirection: "row", alignItems: "center", gap: S.s12, minHeight: 52, paddingHorizontal: S.s14, paddingVertical: S.s8 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{insecables(famille.titre)}</Text>
            <Text style={[T.micro, { color: C.textFaint, marginTop: 1 }]}>{famille.sousTitre}</Text>
          </View>
          <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={ICON.md} color={C.textFaint} />
        </TouchableOpacity>
      </View>
      {ouvert && (
        <View style={{ paddingHorizontal: S.s14, paddingTop: S.s2, paddingBottom: S.s16 }}>
          {famille.blocs.map((b, i) => <Bloc key={b.titre} bloc={b} premier={i === 0} />)}
        </View>
      )}
    </View>
  );
}

export function AProposScreen({ nav }: { nav: Nav }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s14, paddingBottom: S.s12 }}>
        <Text accessibilityRole="header" style={[T.title, { color: C.text, marginHorizontal: S.s2 }]}>{INFOS_TITRE}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.s16, paddingBottom: S.s32 }} showsVerticalScrollIndicator={false}>
        <EnBref />

        {/* Le détail, rangé par familles, toutes repliées à l'ouverture. */}
        <Card radius={RADIUS.lg} padding={0} style={{ marginTop: S.s14, overflow: "hidden" }}>
          {FAMILLES_INFOS.map((f, i) => <Famille key={f.id} famille={f} premiere={i === 0} />)}
        </Card>

        <View style={{ marginTop: S.s12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: S.s12 }}>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => nav.push({ name: "mentions" })}
            accessibilityRole="link"
            style={{ minHeight: CONTROL.md, justifyContent: "center", paddingHorizontal: S.s2 }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Mentions légales et confidentialité</Text>
          </TouchableOpacity>
          <Text style={[T.micro, { color: C.textFaint }]}>Version {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
