import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, S, ICON, shadowCard } from "../theme";
import { Card, Chip } from "../components/ui";
import { getPartis } from "../api";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { useJe, scoreGroupeJe } from "../testProximite/jeProximite";
import { useFollow } from "../follows";
import type { ProximiteScore } from "../testProximite/score";
import type { PartiResume } from "../types";
import type { Nav } from "../nav";

/**
 * Onglet Partis en GRILLE « explore » : mini-cartes à deux colonnes, classées du parti le plus
 * PROCHE au plus LOIN de l'utilisateur (même score que le spectre du résultat de test — cf.
 * `scoreGroupeJe`/`calculerProximite`, jamais une proximité parallèle). Sans « je » (test non
 * fait), tri par nombre de sièges + bandeau d'invitation + pastilles verrouillées.
 *
 * Tout le visuel vient du design system : `Card`/`Chip`, `HemicyclePicto`, tokens `C/F/T/RADIUS/
 * S/ICON/shadowCard`. La couleur n'encode que la DONNÉE (identité de groupe via `couleurGroupe`
 * sur l'hémicycle ; vote-sens `C.pour`/`C.contre` sur l'affinité) — jamais de couleur en dur.
 */

// Seuil « comme toi / pas comme toi » : le score est un TAUX D'ACCORD (accord / comparable),
// dont le point neutre est 0,5 (autant d'accords que de désaccords). On s'aligne donc sur ce
// que le spectre mesure déjà — pas un seuil arbitraire.
const SEUIL_COMME = 0.5;

type Entree = { parti: PartiResume; rang: number | null; score: ProximiteScore | null };
type Cellule = Entree | { spacer: true };
const estSpacer = (c: Cellule): c is { spacer: true } => "spacer" in c;

const nbToNb = (n: number) => `${n} siège${n > 1 ? "s" : ""}`;

export function PartisScreen({ nav }: { nav: Nav }) {
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [loading, setLoading] = useState(true);
  const je = useJe();

  useEffect(() => {
    getPartis().then(setPartis).finally(() => setLoading(false));
  }, []);

  const situe = je != null;
  const seSituer = () => nav.push({ name: "testIntro" });

  // Ordre : situé → du plus proche au plus loin (score du spectre, nuls en dernier, sièges en
  // départage) ; sinon → l'ordre de `getPartis` (déjà nb_deputes décroissant). Le rang # n'est
  // attribué qu'aux partis effectivement classés (score comparable), les autres finissent la liste.
  const entrees = useMemo<Entree[]>(() => {
    const avec = partis.map((p) => ({ p, sc: scoreGroupeJe(je, p.abrev) }));
    if (situe) {
      avec.sort((a, b) => (b.sc?.pct ?? -1) - (a.sc?.pct ?? -1) || b.p.nb_deputes - a.p.nb_deputes);
    }
    let rang = 0;
    return avec.map(({ p, sc }) => ({ parti: p, score: sc, rang: situe && sc ? ++rang : null }));
  }, [partis, je, situe]);

  // Cellule fantôme pour garder une largeur de carte constante quand le nombre est impair.
  const cellules = useMemo<Cellule[]>(
    () => (entrees.length % 2 === 1 ? [...entrees, { spacer: true }] : entrees),
    [entrees]
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: S.s16, paddingTop: S.s14, paddingBottom: S.s10 }}>
        <Text style={[T.title, { color: C.text }]}>Partis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: S.s4 }]}>
          {situe ? "Classés du plus proche au plus loin de toi." : "Classés par nombre de sièges."}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: S.s32 }} />
      ) : (
        <FlatList
          data={cellules}
          keyExtractor={(c, i) => (estSpacer(c) ? `spacer-${i}` : c.parti.uid)}
          numColumns={2}
          columnWrapperStyle={{ gap: S.s12 }}
          contentContainerStyle={{ paddingHorizontal: S.s16, paddingBottom: S.s32, gap: S.s12 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={situe ? null : <InviteSituer onPress={seSituer} />}
          renderItem={({ item }) =>
            estSpacer(item) ? (
              <View style={{ flex: 1 }} />
            ) : (
              <MiniCarte
                entree={item}
                groupes={partis}
                situe={situe}
                onOpen={() => nav.push({ name: "parti", uid: item.parti.uid })}
                onSituer={seSituer}
              />
            )
          }
        />
      )}
    </View>
  );
}

/** Bandeau d'invitation (utilisateur pas encore situé) → mène au deck « te situer ». */
function InviteSituer({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Situe-toi pour classer les partis selon toi"
      style={{
        flexDirection: "row", alignItems: "center", gap: S.s10,
        backgroundColor: C.accent, borderRadius: RADIUS.lg, paddingVertical: 13, paddingHorizontal: S.s14,
        marginBottom: S.s12, ...shadowCard,
      }}
    >
      <Feather name="compass" size={ICON.lg} color={C.onAccent} />
      <View style={{ flex: 1 }}>
        <Text style={[T.small, { fontFamily: F.extra, color: C.onAccent }]}>Situe-toi pour classer les partis selon toi</Text>
        <Text style={[T.micro, { color: C.onAccent, opacity: 0.82, marginTop: 1 }]}>Chaque parti te dira s'il vote comme toi.</Text>
      </View>
      <Feather name="arrow-right" size={ICON.base} color={C.onAccent} />
    </TouchableOpacity>
  );
}

/** Cloche suivre / suivi, style de suivi de l'app (accent quand suivi). Tap isolé (ne rouvre
 *  pas la fiche : en RN le touchable enfant capte l'appui sans le propager à la carte). */
function ClocheSuivi({ uid, nom }: { uid: string; nom: string }) {
  const [suivi, toggle] = useFollow(uid);
  if (!uid) return null;
  return (
    <TouchableOpacity
      onPress={toggle}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityState={{ selected: suivi }}
      accessibilityLabel={suivi ? `Ne plus suivre ${nom}` : `Suivre ${nom}`}
      style={{
        position: "absolute", top: 9, right: 9, width: 32, height: 32, borderRadius: RADIUS.pill,
        alignItems: "center", justifyContent: "center",
        backgroundColor: suivi ? C.accent : C.surfaceAlt,
        borderWidth: 1, borderColor: suivi ? C.accent : C.border,
      }}
    >
      <Feather name="bell" size={ICON.sm} color={suivi ? C.onAccent : C.textMuted} />
    </TouchableOpacity>
  );
}

/** Affinité « comme toi / pas comme toi » (situé) ou « non classé » (situé, rien de comparable),
 *  NON interactive : elle vit dans la zone d'ouverture de la carte. Pastille = `Chip` + tokens de
 *  vote ; barre = même primitive (piste + remplissage) teintée par le SENS du vote. */
function AffiniteVisuel({ score }: { score: ProximiteScore | null }) {
  if (!score) {
    return (
      <View style={{ alignItems: "center", marginTop: S.s10 }}>
        <Chip label="Non classé" bg={C.surfaceAlt} fg={C.textMuted} ph={10} pv={5}
          icon={<Feather name="user" size={ICON.xs} color={C.textMuted} />} />
      </View>
    );
  }
  const comme = score.pct >= SEUIL_COMME;
  const pct = Math.round(score.pct * 100);
  const teinte = comme ? C.pour : C.contre;
  return (
    <View accessibilityLabel={`${comme ? "Comme toi" : "Pas comme toi"}, ${pct} % de proximité`} style={{ marginTop: S.s10 }}>
      <View style={{ alignItems: "center" }}>
        <Chip
          label={`${comme ? "Comme toi" : "Pas comme toi"} · ${pct} %`}
          bg={comme ? C.adopteBg : C.rejeteBg}
          fg={comme ? C.adopteFg : C.rejeteFg}
          ph={10}
          pv={5}
          icon={<Feather name="user" size={ICON.xs} color={comme ? C.adopteFg : C.rejeteFg} />}
        />
      </View>
      {/* Barre : même piste + remplissage que `BarreProximite`, teintée par le sens du vote. */}
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.surfaceSunken, overflow: "hidden", marginTop: 9, marginHorizontal: S.s6 }}>
        <View style={{ height: 5, borderRadius: 3, width: `${pct}%`, backgroundColor: teinte }} />
      </View>
    </View>
  );
}

/** Mini-carte d'un parti : rang · cloche · hémicycle situé · abrév · nom · sièges · affinité.
 *  Sur le web, react-native-web rend chaque zone tactile en <button> : les cibles (ouvrir la
 *  fiche · cloche · pastille verrouillée) sont donc des FRÈRES, jamais imbriquées (DOM valide). */
function MiniCarte({
  entree, groupes, situe, onOpen, onSituer,
}: {
  entree: Entree; groupes: PartiResume[]; situe: boolean; onOpen: () => void; onSituer: () => void;
}) {
  const { parti: p, rang, score } = entree;
  const nom = p.abrev ?? p.libelle;
  return (
    <Card bordered padding={0} radius={RADIUS.lg} style={{ flex: 1, overflow: "hidden" }}>
      {/* Zone d'ouverture de la fiche (consultation) : hémicycle · nom · sièges · affinité. */}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir la fiche ${p.libelle}`}
        style={{ paddingTop: 13, paddingHorizontal: S.s12, paddingBottom: situe ? 13 : 4 }}
      >
        {rang != null && (
          <Text style={[T.micro, tnum, { position: "absolute", top: S.s10, left: S.s12, fontFamily: F.extra, color: C.textFaint }]}>
            #{rang}
          </Text>
        )}
        <View style={{ alignItems: "center", justifyContent: "center", height: 92, marginTop: S.s8 }}>
          <HemicyclePicto groupes={groupes} activeAbrev={p.abrev} color={p.couleur ?? C.textFaint} size={132} />
        </View>
        <Text style={[T.heading, { textAlign: "center", color: C.text, marginTop: S.s6 }]} numberOfLines={1}>{nom}</Text>
        <Text style={[T.micro, { textAlign: "center", color: C.textMuted, marginTop: 2, minHeight: 28 }]} numberOfLines={2}>
          {p.libelle}
        </Text>
        <Text style={[T.micro, tnum, { textAlign: "center", fontFamily: F.bold, color: C.textFaint, marginTop: 2 }]}>
          {nbToNb(p.nb_deputes)}
        </Text>
        {situe && <AffiniteVisuel score={score} />}
      </Pressable>

      {/* Pas encore situé : pastille verrouillée → mène au deck (même endroit que le bandeau). */}
      {!situe && (
        <Pressable
          onPress={onSituer}
          accessibilityRole="button"
          accessibilityLabel="Situe-toi pour voir si ce parti vote comme toi"
          style={{ alignItems: "center", paddingHorizontal: S.s12, paddingTop: S.s10, paddingBottom: 13 }}
        >
          <Chip label="Comme toi ?" bg={C.surfaceAlt} fg={C.textMuted} ph={10} pv={5}
            icon={<Feather name="lock" size={ICON.xs} color={C.textMuted} />} />
        </Pressable>
      )}

      {/* Cloche : frère absolu (au-dessus des zones tactiles, rendu en dernier). */}
      <ClocheSuivi uid={p.uid} nom={p.libelle} />
    </Card>
  );
}
