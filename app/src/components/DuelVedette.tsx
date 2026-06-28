import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { getDuelDuJour, getConfrontationShuffle } from "../api";
import type { DeputeResume, ShuffleConfrontation, AngleShuffle } from "../types";
import type { Nav } from "../nav";

// Contexte neutre du tirage (pourquoi cette paire est intéressante). Ton factuel.
const ANGLE_LABEL: Record<AngleShuffle, string> = {
  fracture_interne: "Même bord, et pourtant…",
  alliance_contre_nature: "Bords opposés, accords inattendus",
  faux_duel: "Ni alliés ni adversaires : ça se joue dossier par dossier",
};

function Visage({ d }: { d: DeputeResume }) {
  if (d.photo_url) {
    return <Image source={{ uri: d.photo_url }} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.surfaceSunken }} />;
  }
  return (
    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: (d.couleur || C.accent) + "22", alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name="account" size={34} color={d.couleur || C.accent} />
    </View>
  );
}

function Elu({ d }: { d: DeputeResume }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Visage d={d} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginTop: 7, textAlign: "center" }]} numberOfLines={2}>
        {d.nom_complet}
      </Text>
      {d.abrev && (
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 1 }]} numberOfLines={1}>
          {d.abrev}
        </Text>
      )}
    </View>
  );
}

/**
 * Bloc « duel » vivant, en tête de l'onglet Partis : aperçu de deux élus, leur taux
 * d'accord, et un bouton « Relancer » (tirage surprise). Touche l'aperçu → le duel complet.
 * Initialisé sur le « duel du jour » (stable), relançable à volonté.
 */
export function DuelVedette({ nav }: { nav: Nav }) {
  const [duel, setDuel] = useState<ShuffleConfrontation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [relance, setRelance] = useState(false);

  useEffect(() => {
    let alive = true;
    getDuelDuJour()
      .then((d) => { if (alive) setDuel(d); })
      .catch(() => {})
      .finally(() => { if (alive) setChargement(false); });
    return () => { alive = false; };
  }, []);

  async function relancer() {
    if (relance) return;
    setRelance(true);
    try {
      const d = await getConfrontationShuffle();
      if (d) setDuel(d);
    } catch { /* un tirage raté ne casse pas l'écran */ } finally {
      setRelance(false);
    }
  }

  if (chargement) {
    return (
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 24, marginBottom: 18, ...shadowCard }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  }
  if (!duel) return null; // vivier indisponible : on n'affiche rien (pas de bloc vide)

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: C.borderStrong, ...shadowCard }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Duel du jour</Text>
        <TouchableOpacity
          onPress={relancer}
          disabled={relance}
          accessibilityLabel="Relancer un tirage"
          style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 4 }}
        >
          {relance ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="shuffle" size={16} color={C.accent} />}
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Relancer</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.85} onPress={() => nav.push({ name: "confrontation", a: duel.a.uid, b: duel.b.uid, angle: duel.angle })}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <Elu d={duel.a} />
          <View style={{ width: 84, alignItems: "center", paddingTop: 8 }}>
            <Text style={[T.title, tnum, { color: C.text }]}>
              {duel.tauxAccord}%
            </Text>
            <Text style={[T.micro, { fontFamily: F.semibold, color: C.textMuted }]}>d'accord</Text>
            <Text style={[T.micro, { color: C.textFaint, marginTop: 2 }]}>{duel.communs} votes</Text>
          </View>
          <Elu d={duel.b} />
        </View>

        <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 14 }]}>
          {ANGLE_LABEL[duel.angle]}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 12 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir leurs votes côte à côte</Text>
          <Feather name="chevron-right" size={16} color={C.accent} />
        </View>
      </TouchableOpacity>
    </View>
  );
}
