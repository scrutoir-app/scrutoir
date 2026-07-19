import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, couleurPosition, couleurGroupe, positionLabel } from "../theme";
import { Card, Chip } from "./ui";
import { HemicyclePicto } from "./HemicyclePicto";
import { useData } from "../hooks/useData";
import { useFollows } from "../follows";
import { getDeputesByUids, getVotesBruts } from "../api";
import type { GroupeVentilation, PartiResume } from "../types";
import type { ContexteJe } from "../testProximite/jeProximite";
import type { Reponse } from "../testProximite/score";
import type { Nav } from "../nav";

// Encart « comme toi ? » de la PAGE SCRUTIN : sur un scrutin que l'utilisateur a tranché
// dans le test de proximité, on confronte SA position à celle de chaque entité suivie
// (groupe PO… ou élu PA…). Contrairement aux cartes du fil (bornées au récent), cet encart
// n'apparaît QUE sur les ~scrutins du test — donc toujours pertinent, jamais chronologique.
// Tokens NEUTRES pour le marqueur (cf. CarteSuivi) : distincts des couleurs de vote.

const estTranche = (p: string | null | undefined): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Position tenue par un GROUPE sur ce scrutin : consigne si donnée, sinon vote majoritaire exprimé. */
function positionGroupe(g: GroupeVentilation): string | null {
  const exprimes = g.pour + g.contre + g.abstention;
  const majorite =
    g.pour >= g.contre && g.pour >= g.abstention ? "pour" : g.contre >= g.abstention ? "contre" : "abstention";
  return g.consigne ?? (exprimes > 0 ? majorite : null);
}

interface Ligne {
  uid: string;
  nom: string;
  abrev: string | null;
  couleur: string | null;
  photo: string | null;
  estParti: boolean;
  position: string | null;
}

/** Avatar carré d'un élu : photo, sinon initiales colorées (aligné sur CarteSuivi). */
function Avatar({ photo, nom, couleur, size = 36 }: { photo: string | null; nom: string; couleur: string | null; size?: number }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }} />;
  const initiales = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
      <Text style={[T.small, { fontFamily: F.extra, color: couleurGroupe(couleur) }]}>{initiales || "?"}</Text>
    </View>
  );
}

/** Marqueur « comme toi » / « pas comme toi » (ou rien si non comparable). Neutre, jamais Pour/Contre. */
function CommeToi({ match }: { match: boolean | null }) {
  if (match == null) return null;
  const fg = match ? C.accent : C.textMuted;
  return (
    <Chip
      label={match ? "comme toi" : "pas comme toi"}
      bg={match ? C.accentSoft : C.surfaceAlt}
      fg={fg}
      ph={8}
      pv={2}
      gap={3}
      icon={<Feather name={match ? "check" : "x"} size={11} color={fg} />}
    />
  );
}

/** Une ligne d'entité suivie : identité + sa position + marqueur d'accord. */
function LigneAccord({ l, maPosition, partis, nav }: { l: Ligne; maPosition: Reponse; partis: PartiResume[]; nav: Nav }) {
  const match: boolean | null = estTranche(maPosition) && estTranche(l.position) ? maPosition === l.position : null;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => nav.push(l.estParti ? { name: "parti", uid: l.uid } : { name: "depute", uid: l.uid })}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border }}
    >
      {l.estParti ? (
        <HemicyclePicto groupes={partis} activeAbrev={l.abrev} color={l.couleur ?? C.textFaint} size={36} />
      ) : (
        <Avatar photo={l.photo} nom={l.nom} couleur={l.couleur} />
      )}
      <Text style={[T.small, { fontFamily: F.bold, color: C.text, flexShrink: 1 }]} numberOfLines={1}>{l.nom}</Text>
      <Text style={[T.small, { fontFamily: F.extra, color: l.position ? couleurPosition(l.position) : C.textFaint, marginLeft: "auto" }]}>
        {l.position ? positionLabel(l.position) : "n'a pas voté"}
      </Text>
      <CommeToi match={match} />
    </TouchableOpacity>
  );
}

/** Ordonne : « comme toi » d'abord, puis « pas comme toi », puis non comparables (abst./absent). */
function rang(l: Ligne, maPosition: Reponse): number {
  if (!estTranche(l.position)) return 2;
  return l.position === maPosition ? 0 : 1;
}

export function AccordSuivis({
  scrutinUid, numero, groupes, partis, je, nav,
}: {
  scrutinUid: string;
  numero: number | null;
  groupes: GroupeVentilation[];
  partis: PartiResume[];
  je: ContexteJe | null;
  nav: Nav;
}) {
  const follows = useFollows();
  const maPosition = je && numero != null ? je.reponses[numero] : undefined;

  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const deputeUids = follows.filter((u) => u.startsWith("PA"));

  // Groupes suivis : lus dans la ventilation DÉJÀ chargée par la page (aucun appel réseau).
  const lignesPartis = useMemo<Ligne[]>(() => {
    const byUid = new Map(groupes.map((g) => [g.uid, g]));
    return partiUids
      .map((u) => byUid.get(u))
      .filter((g): g is GroupeVentilation => !!g)
      .map((g) => ({ uid: g.uid, nom: g.abrev ?? g.libelle, abrev: g.abrev, couleur: g.couleur, photo: null, estParti: true, position: positionGroupe(g) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupes, partiUids.join(",")]);

  // Élus suivis : identité + vote NOMINATIF sur ce scrutin (fichiers élu souvent déjà en cache).
  const { data: lignesDeputes } = useData<Ligne[]>(async () => {
    if (!deputeUids.length) return [];
    const metas = await getDeputesByUids(deputeUids);
    const votes = await Promise.all(deputeUids.map((u) => getVotesBruts(u).catch(() => ({} as Record<string, string>))));
    const votesByUid = new Map(deputeUids.map((u, i) => [u, votes[i]]));
    return metas.map((d) => ({
      uid: d.uid, nom: d.nom_complet, abrev: d.abrev, couleur: d.couleur, photo: d.photo_url,
      estParti: false, position: votesByUid.get(d.uid)?.[scrutinUid] ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deputeUids.join(","), scrutinUid]);

  // N'apparaît QUE si l'utilisateur a tranché CE scrutin dans le test (sinon pas de « toi »).
  if (!estTranche(maPosition)) return null;

  const lignes = [...lignesPartis, ...(lignesDeputes ?? [])].sort((a, b) => rang(a, maPosition) - rang(b, maPosition));
  if (!lignes.length) return null;

  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Feather name="user-check" size={16} color={C.accent} />
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Toi &amp; tes suivis</Text>
      </View>
      <Text style={[T.small, { fontFamily: F.medium, color: C.textMuted, marginBottom: 6 }]}>
        Au test, tu as voté{" "}
        <Text style={{ fontFamily: F.extra, color: couleurPosition(maPosition) }}>{positionLabel(maPosition)}</Text>
        {" "}sur ce texte. Voici ce qu'ont fait celles et ceux que tu suis.
      </Text>
      {lignes.map((l) => (
        <LigneAccord key={l.uid} l={l} maPosition={maPosition} partis={partis} nav={nav} />
      ))}
    </Card>
  );
}
