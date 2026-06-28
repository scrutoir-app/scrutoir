import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, couleurPosition, couleurGroupe, positionLabel, formatDate } from "../theme";
import { catUI } from "../categoryUI";
import { HemicyclePicto } from "./HemicyclePicto";
import { useProximiteDepute, scoreGroupeJe, type ContexteJe, type ProximiteScore } from "../testProximite/jeProximite";
import type { VoteSuivi, PartiResume } from "../types";
import type { Reponse } from "../testProximite/score";
import type { Nav } from "../nav";

// Carte de suivi PARTAGÉE (fil d'accueil + écran Suivis), pour un élu OU un groupe suivi.
// Conventions : surface C.surface, RADIUS.md, shadowCard ; police F, tailles de l'échelle T ;
// couleurs via C ; helpers couleurPosition/positionLabel/formatDate. Rien en dur.

const estTranche = (p: string | undefined): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Identité d'une personne : photo, ou avatar à initiales — carré arrondi (cf. DeputeScreen). */
function Avatar({ photo, nom, couleur, size = 42 }: { photo: string | null; nom: string; couleur: string | null; size?: number }) {
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt }} />;
  const initiales = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: RADIUS.md, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
      <Text style={[T.small, { fontFamily: F.extra, color: couleurGroupe(couleur) }]}>{initiales || "?"}</Text>
    </View>
  );
}

/** Groupe en second : pastille couleur + sigle. */
function GroupChip({ abrev, couleur }: { abrev: string | null; couleur: string | null }) {
  if (!abrev) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 3 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: couleurGroupe(couleur) }} />
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>{abrev}</Text>
    </View>
  );
}

/** Picto du thème du scrutin (catUI, partagé avec les grilles de thèmes). */
export function ThemePicto({ categorie, size = 30 }: { categorie: string | null | undefined; size?: number }) {
  if (!categorie) return null;
  const ui = catUI(categorie);
  return (
    <View style={{ width: size, height: size, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name={ui.icon as any} size={size * 0.56} color={ui.fg} />
    </View>
  );
}

/** Proximité globale en petite pastille ardoise (pas de gros chiffre). */
function ProximitePill({ score }: { score: ProximiteScore | null }) {
  if (!score) return null;
  return (
    <View style={{ backgroundColor: C.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 6 }}>
      <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.accent }]}>{Math.round(score.pct * 100)}% proche</Text>
    </View>
  );
}

/**
 * Marqueur d'accord au vote affiché : « comme toi » / « pas comme toi », sinon rien.
 * Tokens NEUTRES (ardoise / gris) — volontairement DISTINCTS des couleurs de vote
 * (couleurPosition) pour ne pas le confondre avec un Pour/Contre.
 */
function CommeToi({ match }: { match: boolean | null }) {
  if (match == null) return null;
  const fg = match ? C.accent : C.textMuted;
  const bg = match ? C.accentSoft : C.surfaceAlt;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: bg, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Feather name={match ? "check" : "x"} size={11} color={fg} />
      <Text style={[T.micro, { fontFamily: F.bold, color: fg }]}>{match ? "comme toi" : "pas comme toi"}</Text>
    </View>
  );
}

/** Zone du vote : filet + picto thème + position/marqueur + intitulé COMPLET + date. */
function ZoneVote({ v, maPosition }: { v: VoteSuivi; maPosition: Reponse | undefined }) {
  const court = v.categorie ? catUI(v.categorie).court : undefined;
  // Match avec MA position enregistrée sur CE scrutin (rien si je ne m'y suis pas positionné).
  const match: boolean | null =
    estTranche(maPosition) && estTranche(v.position) ? maPosition === v.position : null;
  return (
    <View style={{ flexDirection: "row", gap: 10, marginTop: 11, paddingTop: 11, borderTopWidth: 1, borderTopColor: C.border }}>
      <ThemePicto categorie={v.categorie} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <Text style={[T.micro, { fontFamily: F.extra, color: couleurPosition(v.position) }]}>{positionLabel(v.position)}</Text>
            {court && <Text style={[T.micro, { fontFamily: F.medium, color: C.textMuted }]} numberOfLines={1}>· {court}</Text>}
          </View>
          <CommeToi match={match} />
        </View>
        {!!v.titre && (
          <Text style={[T.small, { fontFamily: F.medium, color: C.text, marginTop: 4 }]} numberOfLines={3}>
            {v.titre}
          </Text>
        )}
        {!!v.date && (
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 3 }]}>{formatDate(v.date)}</Text>
        )}
      </View>
    </View>
  );
}

interface BaseProps {
  v: VoteSuivi;
  partis: PartiResume[];
  je: ContexteJe | null;
  score: ProximiteScore | null;
  estParti: boolean;
  nav: Nav;
}

function Base({ v, partis, je, score, estParti, nav }: BaseProps) {
  const maPosition = je && v.numero != null ? je.reponses[v.numero] : undefined;
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })}
      style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
    >
      {/* Tête : identité + groupe + proximité */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <TouchableOpacity activeOpacity={0.6} onPress={() => nav.push(estParti ? { name: "parti", uid: v.deputeUid } : { name: "depute", uid: v.deputeUid })}>
          {estParti ? (
            <HemicyclePicto groupes={partis} activeAbrev={v.abrev} color={v.couleur ?? C.textFaint} size={42} />
          ) : (
            <Avatar photo={v.photo} nom={v.nom} couleur={v.couleur} />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{estParti ? v.abrev ?? v.nom : v.nom}</Text>
          {estParti ? (
            <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={1}>{v.nom}</Text>
          ) : (
            <GroupChip abrev={v.abrev} couleur={v.couleur} />
          )}
        </View>
        <ProximitePill score={score} />
      </View>

      <ZoneVote v={v} maPosition={maPosition} />
    </TouchableOpacity>
  );
}

/** Carte d'un DÉPUTÉ suivi (proximité = celle de l'élu, via ses votes). */
function CarteDepute(props: Omit<BaseProps, "score" | "estParti">) {
  return <Base {...props} estParti={false} score={useProximiteDepute(props.v.deputeUid)} />;
}

/** Carte d'un GROUPE suivi (position = vote majoritaire du groupe ; proximité de groupe). */
function CarteParti(props: Omit<BaseProps, "score" | "estParti">) {
  return <Base {...props} estParti score={scoreGroupeJe(props.je, props.v.abrev)} />;
}

/** Aiguille vers la bonne carte selon le type d'entité (PA… élu / PO… groupe). */
export function CarteSuivi(props: { v: VoteSuivi; partis: PartiResume[]; je: ContexteJe | null; nav: Nav }) {
  return props.v.deputeUid.startsWith("PO") ? <CarteParti {...props} /> : <CarteDepute {...props} />;
}
