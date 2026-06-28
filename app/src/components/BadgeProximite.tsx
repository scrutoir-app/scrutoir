import React from "react";
import { View, Text } from "react-native";
import { C, F, T, tnum, RADIUS } from "../theme";
import { SEUIL_FIABLE, useProximiteDepute, type ProximiteScore } from "../testProximite/jeProximite";

// Affichage transverse du « tu votes comme X% » issu du test de proximité. La COULEUR
// n'est qu'une identité (groupe/élu) appliquée à la barre de proximité — jamais un encodage
// de vote. Trois formes : barre (liste partis), pastille (lignes/suivis), badge (profils).
// Sans score (pas de « je » OU rien de comparable), tout rend null → l'écran n'affiche rien.

function rgba(hex: string | null | undefined, a: number): string {
  if (!hex) return `rgba(140,150,165,${a})`;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const pourcent = (p: number) => `${Math.round(p * 100)} %`;

/** Barre de proximité + % (pour une ligne de liste, ex. classement des partis). */
export function BarreProximite({ score, couleur }: { score: ProximiteScore | null; couleur?: string | null }) {
  if (!score) return null;
  const col = couleur ?? C.accent;
  const faible = score.comparable < SEUIL_FIABLE;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
        <View style={{ height: 6, borderRadius: 3, width: `${Math.round(score.pct * 100)}%`, backgroundColor: col }} />
      </View>
      <Text style={[T.small, tnum, { fontFamily: F.bold, color: faible ? C.textMuted : C.text, minWidth: 34, textAlign: "right" }]}>
        {pourcent(score.pct)}
      </Text>
    </View>
  );
}

/** Pastille compacte « 78 % comme toi » (lignes de suivis, strips). */
export function PastilleProximite({ score, couleur }: { score: ProximiteScore | null; couleur?: string | null }) {
  if (!score) return null;
  const col = couleur ?? C.accent;
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start",
        backgroundColor: rgba(col, 0.12), paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: col }} />
      <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.text }]}>{pourcent(score.pct)} comme toi</Text>
    </View>
  );
}

/** Badge « profil » : carte mise en avant (fiche député / groupe). */
export function BadgeProximite({ score, couleur }: { score: ProximiteScore | null; couleur?: string | null }) {
  if (!score) return null;
  const col = couleur ?? C.accent;
  const faible = score.comparable < SEUIL_FIABLE;
  const n = score.comparable;
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: rgba(col, 0.35) }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>D'après ton test, tu votes comme</Text>
        <Text style={[T.title, tnum, { color: C.text }]}>
          {Math.round(score.pct * 100)}
          <Text style={[T.small, { fontFamily: F.bold, color: C.textFaint }]}> %</Text>
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surfaceSunken, overflow: "hidden", marginTop: 9 }}>
        <View style={{ height: 6, borderRadius: 3, width: `${Math.round(score.pct * 100)}%`, backgroundColor: col }} />
      </View>
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 7 }]}>
        {n} vote{n > 1 ? "s" : ""} comparé{n > 1 ? "s" : ""}
        {faible ? " · base trop faible, à confirmer" : ""}
      </Text>
    </View>
  );
}

// --- Variantes auto-branchées sur un DÉPUTÉ (chargent ses votes via le hook) -------

export function ProximiteDeputeBadge({ uid, couleur }: { uid: string; couleur?: string | null }) {
  return <BadgeProximite score={useProximiteDepute(uid)} couleur={couleur} />;
}

export function ProximiteDeputePastille({ uid, couleur }: { uid: string; couleur?: string | null }) {
  return <PastilleProximite score={useProximiteDepute(uid)} couleur={couleur} />;
}
