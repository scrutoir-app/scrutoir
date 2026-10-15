import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, CONTROL, couleurGroupe } from "../theme";
import { Card } from "../components/ui";
import { getPartis } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { HemicycleLogo } from "../components/HemicycleLogo";
import { Filet } from "../components/texteUI";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { useFollow } from "../hooks/useFollows";
import { estSitue } from "../testProximite/storage";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";

/**
 * Onglet Partis. Maquette validée le 15/10/2026 (`maquette-partis-hemicycle-logo.html`) :
 *  · UN SEUL hémicycle, celui du logo (18 sièges, `HemicycleLogo`), chaque siège aux couleurs
 *    officielles du groupe qui l'occupe (`couleurGroupe`). Approximatif ASSUMÉ (choix d'Anthony) :
 *    18 points pour 577 sièges, un groupe moyen n'a qu'un ou deux points ;
 *  · une liste simple, par nombre de sièges : sigle, nom, sièges, cloche de suivi ;
 *  · UNE invitation à se situer (au lieu d'un « Comme toi ? » verrouillé par groupe). Une fois
 *    situé, le même encart mène au classement des groupes du résultat du test.
 * Plus de classement ni de % « comme toi » par groupe ici : ils vivent sur la fiche d'un parti
 * et dans le résultat du test.
 */

export function PartisScreen({ nav }: { nav: Nav }) {
  const { data: partis, loading, error, retry } = useData(() => getPartis(), []);
  const [situe] = useState(estSitue);
  const [largeur, setLargeur] = useState(0);

  const liste = useMemo(() => [...(partis ?? [])].sort((a, b) => b.nb_deputes - a.nb_deputes), [partis]);
  const total = liste.reduce((n, p) => n + p.nb_deputes, 0);
  const ni = liste.find((p) => p.abrev === "NI")?.nb_deputes ?? 0;
  const nbGroupes = liste.filter((p) => p.abrev !== "NI").length;
  const max = liste[0]?.nb_deputes || 1;
  const couleurs = useMemo(() => new Map(liste.map((p) => [p.abrev ?? "", couleurGroupe(p.couleur)])), [liste]);
  const geo = useMemo(() => liste.map((p) => ({ abrev: p.abrev, nb_deputes: p.nb_deputes })), [liste]);
  const ordre = ORDRE_HEMICYCLE.filter((ab) => couleurs.has(ab)).join(", ");

  if (loading && !partis) return <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s40 }} />;
  if (!partis) return error ? <ErreurChargement onRetry={retry} /> : null;

  const hemi = Math.min((largeur || 320) * 0.86, 300);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: S.s16, paddingTop: S.s14, paddingBottom: S.s40 }}>
      <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>Partis</Text>
      <Text style={[T.small, tnum, { color: C.textMuted, marginTop: S.s4 }]}>
        {total} députés en fonction, {nbGroupes} groupes{ni ? ` et ${ni} non-inscrit${ni > 1 ? "s" : ""}` : ""}
      </Text>

      {/* L'hémicycle du logo, aux couleurs des groupes (de gauche à droite). */}
      <Card padding={S.s16} radius={RADIUS.lg} style={{ marginTop: S.s14 }}>
        <View onLayout={(e: LayoutChangeEvent) => setLargeur(e.nativeEvent.layout.width)} style={{ alignItems: "center", paddingTop: S.s8 }}>
          <HemicycleLogo
            groupes={geo}
            size={hemi}
            couleur={(ab) => couleurs.get(ab) ?? null}
            label={`Hémicycle schématique, 18 sièges : les groupes de gauche à droite, ${ordre}.`}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: S.s6 }}>
          <Text style={[T.micro, { color: C.textFaint }]}>Gauche</Text>
          <Text style={[T.micro, { color: C.textFaint }]}>Droite</Text>
        </View>
      </Card>

      {/* Une seule invitation (non situé) ; situé, le même encart mène au classement du test. */}
      <TouchableOpacity
        onPress={() => nav.push(situe ? { name: "testResultat" } : { name: "testIntro" })}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{ flexDirection: "row", alignItems: "center", gap: S.s10, marginTop: S.s12, backgroundColor: C.accent, borderRadius: RADIUS.lg, paddingVertical: S.s12, paddingHorizontal: S.s14 }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.onAccent }]}>
            {situe ? "Ta proximité avec chaque groupe" : "Classe les groupes selon tes votes"}
          </Text>
          <Text style={[T.small, { color: C.onAccent, opacity: 0.82, marginTop: 1 }]}>
            {situe ? "Ton résultat, sur les votes que tu as tranchés" : "Situe-toi en quelques scrutins"}
          </Text>
        </View>
        <Feather name="chevron-right" size={ICON.base} color={C.onAccent} />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: S.s24, marginBottom: S.s10 }}>
        <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Les groupes</Text>
        <Text style={[T.small, { color: C.textMuted }]}>Par nombre de sièges</Text>
      </View>
      <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden" }}>
        {liste.map((p, i) => (
          <View key={p.uid}>
            {i > 0 && <Filet retrait={36} />}
            <LigneGroupe p={p} couleur={couleurs.get(p.abrev ?? "") ?? C.textFaint} part={p.nb_deputes / max} onOpen={() => nav.push({ name: "parti", uid: p.uid })} />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

/** Une ligne de groupe : pastille de couleur, sigle et nom (ouvrent la fiche), sièges + barre, cloche. */
function LigneGroupe({ p, couleur, part, onOpen }: { p: PartiResume; couleur: string; part: number; onOpen: () => void }) {
  const [suivi, toggle] = useFollow(p.uid);
  const sigle = p.abrev ?? p.libelle;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: S.s14, paddingRight: S.s6 }}>
      {/* Zones tactiles SŒURS (jamais imbriquées) : la fiche, puis la cloche. */}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${p.libelle}, ${p.nb_deputes} siège${p.nb_deputes > 1 ? "s" : ""}. Ouvrir la fiche`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: S.s12, paddingVertical: S.s12, minHeight: 60 }}
      >
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: couleur }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{sigle}</Text>
          <Text style={[T.small, { color: C.textMuted }]} numberOfLines={1}>{p.libelle}</Text>
        </View>
        <View style={{ width: 60, alignItems: "flex-end" }}>
          <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{p.nb_deputes}</Text>
          <View style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: C.surfaceSunken, marginTop: S.s4, flexDirection: "row", justifyContent: "flex-end" }}>
            <View style={{ width: `${Math.max(4, Math.round(part * 100))}%`, height: 3, borderRadius: 2, backgroundColor: couleur }} />
          </View>
        </View>
      </Pressable>
      <TouchableOpacity
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ selected: suivi }}
        accessibilityLabel={suivi ? `Ne plus suivre ${sigle}` : `Suivre ${sigle}`}
        style={{ width: CONTROL.md, height: CONTROL.md, marginLeft: S.s6, alignItems: "center", justifyContent: "center" }}
      >
        <View style={{ width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", backgroundColor: suivi ? C.accent : "transparent" }}>
          <Feather name="bell" size={ICON.sm} color={suivi ? C.onAccent : C.textMuted} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
