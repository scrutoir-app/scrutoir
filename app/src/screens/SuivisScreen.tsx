import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, S, tnum, RADIUS, CONTROL, shadowCard, couleurGroupe, couleurPosition, positionLabel } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis, getDeputesByUids, getDossiers } from "../api";
import { markSeen } from "../follows";
import { useFollows } from "../hooks/useFollows";
import { useData } from "../hooks/useData";
import { ErreurChargement } from "../components/ErreurChargement";
import { ThemePicto } from "../components/CarteSuivi";
import { aujourdhuiParis } from "../hebdo";
import {
  regrouperParVote,
  decrireLigne,
  filtrerLignes,
  nbFiltresActifs,
  initiales,
  phraseLigne,
  type LigneVote,
  type PeriodeSuivis,
  type IssueSuivis,
} from "../suivisFil";
import type { Nav } from "../nav";

// Écran Suivis (maquette validée le 15/10/2026, `maquette-suivis-un-vote-tous-tes-suivis.html`) :
// une ligne par vote — ce qui a été voté, le texte de loi en contexte — et dessous la position de
// chacun de tes suivis en pastilles. Puces de tes suivis en haut (filtre « par qui »), période et
// issue derrière le bouton « Filtres ». Logique pure dans `suivisFil.ts` ; la liste des suivis
// reste sur l'appareil (aucune mesure d'audience ne la porte).

const PAGE = 20;

interface Suivi {
  uid: string;
  nom: string;
  /** Sigle du groupe (puce d'un groupe) ; null pour un député. */
  abrev: string | null;
  couleur: string | null;
  estParti: boolean;
}

interface Opt<V extends string> { v: V; label: string; bg?: string; fg?: string }

/** Contrôle segmenté (même langage que la période des fiches). */
function Segmented<V extends string>({ label, options, value, onChange }: { label: string; options: Opt<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <View>
      <Text style={[T.micro, { color: C.textMuted, marginBottom: 6, marginLeft: 2 }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12 }}>
        {options.map((o) => {
          const actif = value === o.v;
          return (
            <TouchableOpacity
              key={o.v}
              onPress={() => onChange(o.v)}
              accessibilityRole="radio"
              // RN Web ne traduit pas accessibilityState : props ARIA directes.
              aria-checked={actif}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: CONTROL.sm, borderRadius: 9, backgroundColor: actif ? (o.bg ?? C.surface) : "transparent", ...(actif && !o.bg ? shadowCard : {}) }}
            >
              <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? (o.fg ?? C.text) : C.textMuted }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Pastille à initiales d'un député, cerclée de la couleur de son groupe. */
function Initiales({ nom, couleur, size, fond }: { nom: string; couleur: string | null; size: number; fond: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size > 24 ? 2 : 1.5, borderColor: couleurGroupe(couleur), backgroundColor: fond, alignItems: "center", justifyContent: "center" }}>
      <Text style={[T.micro, { fontFamily: F.extra, color: C.accent, letterSpacing: -0.3 }]} numberOfLines={1}>{initiales(nom)}</Text>
    </View>
  );
}

/** Puce d'un suivi (filtre « par qui ») : initiales cerclées pour un député, point de couleur pour un groupe. */
function PuceSuivi({ s, actif, onPress }: { s: Suivi; actif: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      aria-checked={actif}
      accessibilityLabel={s.nom}
      style={{
        flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: 40, borderRadius: RADIUS.pill,
        paddingLeft: s.estParti ? 14 : 5, paddingRight: 14,
        backgroundColor: actif ? C.accentSoft : C.surface, borderWidth: 1, borderColor: actif ? C.accent : C.borderStrong,
      }}
    >
      {s.estParti ? (
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: couleurGroupe(s.couleur) }} />
      ) : (
        <Initiales nom={s.nom} couleur={s.couleur} size={30} fond={C.surfaceSunken} />
      )}
      <Text style={[T.small, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{s.estParti ? s.abrev ?? s.nom : s.nom}</Text>
    </TouchableOpacity>
  );
}

/** Pastille sous un vote : qui (initiales ou groupe) puis sa position (point de couleur + libellé). */
function PastilleSuivi({ s, position }: { s: Suivi; position: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.surfaceSunken, borderRadius: RADIUS.pill, paddingVertical: 4, paddingLeft: s.estParti ? 9 : 4, paddingRight: 9 }}>
      {s.estParti ? (
        <>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleurGroupe(s.couleur) }} />
          <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>{s.abrev ?? s.nom}</Text>
        </>
      ) : (
        <Initiales nom={s.nom} couleur={s.couleur} size={22} fond={C.surface} />
      )}
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurPosition(position) }} />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.text }]}>{positionLabel(position)}</Text>
    </View>
  );
}

function LigneSuivis({ l, suivis, titres, annee, premier, nav }: {
  l: LigneVote; suivis: Map<string, Suivi>; titres: Map<string, string>; annee: string; premier: boolean; nav: Nav;
}) {
  const nomDe = (uid: string) => suivis.get(uid)?.nom ?? "Suivi";
  // Libellés calculés pour les seules lignes affichées (des milliers de votes au total).
  const d = useMemo(() => decrireLigne(l, titres, annee), [l, titres, annee]);
  return (
    <>
      {!premier && <View style={{ height: 1, backgroundColor: C.border, marginLeft: 14 }} />}
      <TouchableOpacity
        onPress={() => nav.push({ name: "scrutin", uid: l.scrutinUid })}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={phraseLigne(l, d, nomDe, positionLabel)}
        style={{ paddingHorizontal: 14, paddingVertical: 13 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8 }}>
          <ThemePicto categorie={l.categorie} size={24} />
          <Text style={[T.micro, tnum, { color: C.textFaint, flexShrink: 1 }]} numberOfLines={1}>{d.meta}</Text>
        </View>
        <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 6 }]} numberOfLines={3}>{d.titre}</Text>
        {!!d.contexte && <Text style={[T.small, { color: C.textMuted, marginTop: 2 }]} numberOfLines={2}>{d.contexte}</Text>}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
          {l.positions.map((p) => {
            const s = suivis.get(p.uid);
            return s ? <PastilleSuivi key={p.uid} s={s} position={p.position} /> : null;
          })}
        </View>
      </TouchableOpacity>
    </>
  );
}

/**
 * Écran Suivis = flux COMPLET et persistant des suivis (élus + partis). `source` pré-sélectionne
 * une catégorie de suivis (depuis le « Voir tout » d'une section, ou après « Trouver ton député »).
 */
export function SuivisScreen({ source, nav }: { source?: "deputes" | "partis"; nav: Nav }) {
  const follows = useFollows();
  const deputeUids = useMemo(() => follows.filter((u) => u.startsWith("PA")), [follows]);
  const partiUids = useMemo(() => follows.filter((u) => u.startsWith("PO")), [follows]);

  const [periode, setPeriode] = useState<PeriodeSuivis>("all");
  const [issue, setIssue] = useState<IssueSuivis>("all");
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [nb, setNb] = useState(PAGE);
  // Sélection « par qui » : vide = tous. Pré-remplie selon la source d'entrée.
  const [selection, setSelection] = useState<Set<string>>(() =>
    new Set(source === "deputes" ? deputeUids : source === "partis" ? partiUids : [])
  );

  useEffect(() => { markSeen(); }, []);

  const aujourdhui = aujourdhuiParis();
  const { data, loading, error, retry } = useData(
    () =>
      Promise.all([
        getVotesSuivis(deputeUids, Infinity),
        getVotesPartisSuivis(partiUids, Infinity),
        getDeputesByUids(deputeUids),
        getPartis(),
        getDossiers(),
      ]).then(([d, p, deputes, partis, dossiers]) => {
        // Ordre des puces : les députés puis les groupes, chacun dans l'ordre où tu les as suivis.
        const suivis: Suivi[] = [
          ...deputes.map((x) => ({ uid: x.uid, nom: x.nom_complet, abrev: null, couleur: x.couleur ?? null, estParti: false })),
          ...partiUids
            .map((u) => partis.find((x) => x.uid === u))
            .filter((x): x is NonNullable<typeof x> => !!x)
            .map((x) => ({ uid: x.uid, nom: x.abrev ?? x.libelle, abrev: x.abrev, couleur: x.couleur, estParti: true })),
        ];
        const titres = new Map(dossiers.map((x) => [x.ref, x.titre]));
        const lignes = regrouperParVote([...d, ...p], suivis.map((s) => s.uid));
        return { suivis, lignes, titres };
      }),
    [follows.join(",")]
  );

  const suivis = data?.suivis ?? [];
  const parUid = useMemo(() => new Map(suivis.map((s) => [s.uid, s])), [suivis]);
  const filtrees = useMemo(
    () => filtrerLignes(data?.lignes ?? [], { periode, issue, selection, aujourdhui }),
    [data, periode, issue, selection, aujourdhui]
  );
  useEffect(() => { setNb(PAGE); }, [periode, issue, selection]);

  const toggle = (uid: string) => setSelection((prev) => {
    const next = new Set(prev);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    return next;
  });
  const actifs = nbFiltresActifs(periode, issue);
  const seul = selection.size === 1 ? parUid.get([...selection][0]) : null;

  if (follows.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={[T.title, { color: C.text, marginHorizontal: 2 }]} accessibilityRole="header">Suivis</Text>
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 20 }}>
          <MaterialCommunityIcons name="bell-outline" size={40} color={C.textFaint} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 14, textAlign: "center" }]}>
            Tu ne suis personne pour l'instant
          </Text>
          <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 6, textAlign: "center" }]}>
            Ouvre la fiche d'un député ou d'un groupe et touche la cloche « Suivre ».
            Ses derniers votes apparaîtront ici.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={[T.title, { color: C.text, marginHorizontal: 2 }]} accessibilityRole="header">Suivis</Text>
        <TouchableOpacity
          onPress={() => setFiltresOuverts((o) => !o)}
          activeOpacity={0.7}
          accessibilityRole="button"
          aria-expanded={filtresOuverts}
          accessibilityLabel={actifs ? `Filtres, ${actifs} actif${actifs > 1 ? "s" : ""}` : "Filtres"}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: CONTROL.md, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: actifs ? C.accentSoft : C.surface, ...shadowCard }}
        >
          <MaterialCommunityIcons name="filter-variant" size={16} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Filtres</Text>
          {actifs > 0 && (
            <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.onAccent }]}>{actifs}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {filtresOuverts && (
        <View style={{ marginTop: 12, gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 14, ...shadowCard }}>
          <Segmented<PeriodeSuivis>
            label="Période"
            value={periode}
            onChange={setPeriode}
            options={[{ v: "all", label: "Depuis 2024" }, { v: "12m", label: "12 mois" }, { v: "6m", label: "6 mois" }]}
          />
          <Segmented<IssueSuivis>
            label="Issue"
            value={issue}
            onChange={setIssue}
            options={[
              { v: "all", label: "Toutes" },
              { v: "adopte", label: "Adoptés", bg: C.adopteBg, fg: C.adopteFg },
              { v: "rejete", label: "Rejetés", bg: C.rejeteBg, fg: C.rejeteFg },
            ]}
          />
        </View>
      )}

      {/* Puces de tes suivis : « Tous », puis chaque suivi (plusieurs choix possibles). */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ gap: S.s8, paddingHorizontal: 16 }}>
        <TouchableOpacity
          onPress={() => setSelection(new Set())}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          aria-checked={selection.size === 0}
          accessibilityLabel="Tous tes suivis"
          style={{ justifyContent: "center", minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: selection.size === 0 ? C.accent : C.borderStrong, backgroundColor: selection.size === 0 ? C.accent : C.surface }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: selection.size === 0 ? C.onAccent : C.text }]}>Tous</Text>
        </TouchableOpacity>
        {suivis.map((s) => <PuceSuivi key={s.uid} s={s} actif={selection.has(s.uid)} onPress={() => toggle(s.uid)} />)}
      </ScrollView>

      {seul && (
        <TouchableOpacity
          onPress={() => nav.push(seul.estParti ? { name: "parti", uid: seul.uid } : { name: "depute", uid: seul.uid })}
          activeOpacity={0.7}
          accessibilityRole="link"
          style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, minHeight: CONTROL.md, marginHorizontal: 2 }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir la fiche {seul.estParti ? "du groupe" : `de ${seul.nom}`}</Text>
          <Feather name="chevron-right" size={16} color={C.accent} />
        </TouchableOpacity>
      )}

      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, marginTop: seul ? 6 : 18, marginBottom: 8, marginHorizontal: 2 }]}>
        {suivis.length === 1 || selection.size === 1 ? "Ses derniers votes" : "Leurs derniers votes"}
      </Text>

      {loading && !data ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : error && !data ? (
        <ErreurChargement onRetry={retry} compact />
      ) : filtrees.length === 0 ? (
        <Text style={[T.small, { color: C.textMuted, marginTop: 20, textAlign: "center" }]}>
          {data?.lignes.length ? "Aucun vote ne correspond à ces filtres." : "Aucun vote nominatif pour tes suivis."}
        </Text>
      ) : (
        <>
          <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, overflow: "hidden", ...shadowCard }}>
            {filtrees.slice(0, nb).map((l, i) => (
              <LigneSuivis key={l.scrutinUid} l={l} suivis={parUid} titres={data!.titres} annee={aujourdhui.slice(0, 4)} premier={i === 0} nav={nav} />
            ))}
          </View>
          {filtrees.length > nb && (
            <TouchableOpacity
              onPress={() => setNb((n) => n + PAGE)}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={{ alignItems: "center", justifyContent: "center", minHeight: CONTROL.md, marginTop: 4 }}
            >
              <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir plus de votes</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </ScrollView>
  );
}
