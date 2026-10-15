import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, LayoutChangeEvent } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, CONTROL, couleurGroupe } from "../theme";
import { Card } from "../components/ui";
import { getPartis } from "../api";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { HemicycleLogo } from "../components/HemicycleLogo";
import { Filet } from "../components/texteUI";
import { ORDRE_HEMICYCLE, type GroupeGeo } from "../components/hemicycleGeo";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { useFollow } from "../hooks/useFollows";
import { estSitue } from "../testProximite/storage";
import { chargerJe, type ContexteJe } from "../testProximite/jeProximite";
import { affiniteGroupes, type AffiniteGroupe } from "../testProximite/affiniteGroupes";
import { surNVotes } from "../testProximite/spectre";
import { SEUIL_FIABILITE } from "../config";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";

/**
 * Onglet Partis. Maquette validée le 15/10/2026 (`maquette-partis-hemicycle-logo.html`) :
 *  · UN SEUL hémicycle, celui du logo (18 sièges, `HemicycleLogo`), chaque siège aux couleurs
 *    officielles du groupe qui l'occupe (`couleurGroupe`). Approximatif ASSUMÉ (choix d'Anthony) :
 *    18 points pour 577 sièges, un groupe moyen n'a qu'un ou deux points ;
 *  · une liste simple : sigle, nom, sièges, cloche de suivi ;
 *  · UNE invitation à se situer (au lieu d'un « Comme toi ? » verrouillé par groupe).
 * Une fois situé (v1.26.0, demande d'Anthony : lire l'appli par le prisme de l'utilisateur), chaque
 * groupe montre son « % comme toi » et sa base (« sur N votes »), les mêmes chiffres que le spectre
 * du résultat du test (`affiniteGroupes` → `lignesSpectre`), sans % sous SEUIL_FIABILITE votes
 * comparés ; la liste est triée par affinité décroissante, sans rang. Calcul 100 % sur l'appareil.
 */

export function PartisScreen({ nav }: { nav: Nav }) {
  const { data: partis, loading, error, retry } = useData(() => getPartis(), []);
  const [situe] = useState(estSitue);
  const [largeur, setLargeur] = useState(0);
  // Contexte du test (local) : null tant qu'il charge ; « erreur » = on retombe sur l'ordre des sièges.
  const [je, setJe] = useState<ContexteJe | "erreur" | null>(null);
  useEffect(() => {
    if (!situe) return;
    let vivant = true;
    chargerJe()
      .then((c) => vivant && setJe(c ?? "erreur"))
      .catch(() => vivant && setJe("erreur"));
    return () => {
      vivant = false;
    };
  }, [situe]);
  const resultat = je && je !== "erreur" ? je.resultat : null;

  const liste = useMemo(() => [...(partis ?? [])].sort((a, b) => b.nb_deputes - a.nb_deputes), [partis]);
  const total = liste.reduce((n, p) => n + p.nb_deputes, 0);
  const ni = liste.find((p) => p.abrev === "NI")?.nb_deputes ?? 0;
  const nbGroupes = liste.filter((p) => p.abrev !== "NI").length;
  const max = liste[0]?.nb_deputes || 1;
  const couleurs = useMemo(() => new Map(liste.map((p) => [p.abrev ?? "", couleurGroupe(p.couleur)])), [liste]);
  const geo = useMemo(() => liste.map((p) => ({ abrev: p.abrev, nb_deputes: p.nb_deputes })), [liste]);
  const ordre = ORDRE_HEMICYCLE.filter((ab) => couleurs.has(ab)).join(", ");
  const lignes = useMemo(() => affiniteGroupes(liste, resultat), [liste, resultat]);
  const enCalcul = situe && je === null; // pas d'ordre provisoire qui sauterait au chargement

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
            {situe ? "Ton résultat en détail" : "Classe les groupes selon tes votes"}
          </Text>
          <Text style={[T.small, { color: C.onAccent, opacity: 0.82, marginTop: 1 }]}>
            {situe ? "La marge d'erreur, et comment affiner" : "Situe-toi en quelques scrutins"}
          </Text>
        </View>
        <Feather name="chevron-right" size={ICON.base} color={C.onAccent} />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: S.s24 }}>
        <Text accessibilityRole="header" style={[T.heading, { color: C.text }]}>Les groupes</Text>
        <Text style={[T.small, { color: C.textMuted }]}>{resultat ? "Par affinité avec toi" : "Par nombre de sièges"}</Text>
      </View>
      {resultat && (
        <Text style={[T.small, { color: C.textMuted, marginTop: S.s4 }]}>
          La part des votes où le groupe a voté comme toi, sur les scrutins que tu as tranchés. Sous {SEUIL_FIABILITE} votes comparés, pas de pourcentage.
        </Text>
      )}
      {enCalcul ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s24 }} />
      ) : (
        <Card padding={0} radius={RADIUS.lg} style={{ overflow: "hidden", marginTop: S.s10 }}>
          {lignes.map((l, i) => (
            <View key={l.parti.uid}>
              {i > 0 && <Filet retrait={66} />}
              <LigneGroupe
                l={l}
                geo={geo}
                affinite={!!resultat}
                couleur={couleurs.get(l.parti.abrev ?? "") ?? C.textFaint}
                part={l.parti.nb_deputes / max}
                onOpen={() => nav.push({ name: "parti", uid: l.parti.uid, ...(resultat ? { sansUid: true } : null) })}
              />
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

/**
 * Une ligne de groupe : pastille de couleur, sigle et nom (ouvrent la fiche), puis à droite :
 *  · pas situé : les sièges et leur barre ;
 *  · situé (`affinite`) : le « % comme toi » en avant et sa base en petit ; sous le seuil, « pas
 *    assez de votes » en gris ; les sièges passent à côté du sigle.
 * Cloche de suivi. Situé, le geste est mesuré SANS dire quel groupe (comme sur le résultat du
 * test, écart E2 du lot 3) : depuis une liste triée par affinité, le groupe suivi laisserait
 * deviner le résultat.
 */
function LigneGroupe({ l, geo, affinite, couleur, part, onOpen }: { l: AffiniteGroupe<PartiResume>; geo: GroupeGeo[]; affinite: boolean; couleur: string; part: number; onOpen: () => void }) {
  const p = l.parti;
  const [suivi, toggle] = useFollow(p.uid, affinite ? { sansUid: true, contexte: "test" } : undefined);
  const sigle = p.abrev ?? p.libelle;
  const sieges = `${p.nb_deputes} siège${p.nb_deputes > 1 ? "s" : ""}`;
  const pct = l.pct != null ? Math.round(l.pct * 100) : null;
  const affiniteTxt = !affinite ? "" : pct != null ? `, ${pct} % comme toi, ${surNVotes(l.votes)}` : l.votes ? `, pas assez de votes, ${surNVotes(l.votes)}` : ", aucun vote comparé";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: S.s14, paddingRight: S.s6 }}>
      {/* Zones tactiles SŒURS (jamais imbriquées) : la fiche, puis la cloche. */}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${p.libelle}, ${sieges}${affiniteTxt}. Ouvrir la fiche`}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: S.s12, paddingVertical: S.s12, minHeight: 60 }}
      >
        {/* Le logo Scrutoir adapté au groupe : ses sièges en couleur, les autres en gris. */}
        <HemicyclePicto groupes={geo} activeAbrev={p.abrev} color={p.couleur ?? C.textFaint} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>
            {sigle}
            {affinite && <Text style={[T.small, tnum, { fontFamily: F.medium, color: C.textMuted }]}>{`  ${sieges}`}</Text>}
          </Text>
          <Text style={[T.small, { color: C.textMuted }]} numberOfLines={1}>{p.libelle}</Text>
        </View>
        {affinite ? (
          <View style={{ minWidth: 84, maxWidth: 124, alignItems: "flex-end" }}>
            {pct != null ? (
              <Text style={[T.heading, tnum, { fontFamily: F.extra, color: C.text }]}>{pct} %</Text>
            ) : (
              <Text style={[T.micro, { color: C.textFaint, textAlign: "right" }]} numberOfLines={1}>{l.votes ? "pas assez de votes" : "aucun vote comparé"}</Text>
            )}
            {l.votes > 0 && <Text style={[T.micro, tnum, { color: C.textFaint, marginTop: pct != null ? 0 : 2 }]}>{surNVotes(l.votes)}</Text>}
          </View>
        ) : (
          <View style={{ width: 60, alignItems: "flex-end" }}>
            <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text }]}>{p.nb_deputes}</Text>
            <View style={{ width: 60, height: 3, borderRadius: 2, backgroundColor: C.surfaceSunken, marginTop: S.s4, flexDirection: "row", justifyContent: "flex-end" }}>
              <View style={{ width: `${Math.max(4, Math.round(part * 100))}%`, height: 3, borderRadius: 2, backgroundColor: couleur }} />
            </View>
          </View>
        )}
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
