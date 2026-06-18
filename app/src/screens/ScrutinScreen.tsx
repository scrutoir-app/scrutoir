import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, formatDate, positionLabel } from "../theme";
import { getScrutin } from "../api";
import type { DetailScrutin } from "../types";
import { VoteBar } from "../components/VoteBar";
import type { Nav } from "../nav";

export function ScrutinScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [data, setData] = useState<DetailScrutin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    getScrutin(uid)
      .then((d) => vivant && setData(d))
      .finally(() => vivant && setLoading(false));
    return () => {
      vivant = false;
    };
  }, [uid]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return null;

  const s = data.scrutin;
  const adopte = s.sort_code === "adopte";
  const titreCourt = (s.titre || s.objet || "").slice(0, 80);

  // Liste des votants pour une position (eventuellement filtree par groupe).
  const goVotants = (position: string, groupe?: string, groupeLibelle?: string) =>
    nav.push({ name: "votants", scrutinUid: uid, titre: titreCourt, position, groupe, groupeLibelle });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View
        style={{
          alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
          marginBottom: 10, backgroundColor: adopte ? C.loyalHautBg : C.loyalBasBg,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "500", color: adopte ? C.loyalHaut : C.loyalBas }}>
          {s.sort_libelle ?? (adopte ? "Adopté" : "Rejeté")}
        </Text>
      </View>

      <Text style={{ fontSize: 16, color: C.text, lineHeight: 23 }}>{s.titre || s.objet}</Text>
      <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
        {formatDate(s.date)} · scrutin n° {s.numero}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 4 }}>
        <Chiffre label="Pour" valeur={s.pour} color={C.pour} onPress={() => goVotants("pour")} />
        <Chiffre label="Contre" valeur={s.contre} color={C.contre} onPress={() => goVotants("contre")} />
        <Chiffre label="Abst." valeur={s.abstention} color={C.abstention} onPress={() => goVotants("abstention")} />
      </View>
      <Text style={{ fontSize: 11, color: C.textFaint }}>Touchez un chiffre pour voir qui a voté.</Text>

      <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: "500", marginTop: 18, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Position par groupe
      </Text>

      {data.groupes.map((g) => {
        const nom = g.abrev ?? g.libelle;
        return (
          <View key={g.uid} style={{ paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: C.text, flex: 1 }} numberOfLines={1}>
                {nom}
              </Text>
              <Text style={{ fontSize: 11, color: C.textMuted }}>
                consigne : <Text style={{ color: C.text }}>{positionLabel(g.consigne)}</Text>
              </Text>
            </View>
            <VoteBar pour={g.pour} contre={g.contre} abstention={g.abstention} absent={g.absent} height={7} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <GroupeChip n={g.pour} label="pour" color={C.pour} onPress={() => goVotants("pour", g.uid, nom)} />
              <GroupeChip n={g.contre} label="contre" color={C.contre} onPress={() => goVotants("contre", g.uid, nom)} />
              <GroupeChip n={g.abstention} label="abst." color={C.abstention} onPress={() => goVotants("abstention", g.uid, nom)} />
              <GroupeChip n={g.absent} label="absent" color={C.absent} onPress={() => goVotants("nonvotant", g.uid, nom)} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Chiffre({
  label, valeur, color, onPress,
}: {
  label: string;
  valeur: number;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={valeur === 0}
      onPress={onPress}
      style={{ flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 12, opacity: valeur === 0 ? 0.5 : 1 }}
    >
      <Text style={{ fontSize: 12, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "500", color, marginTop: 2 }}>{valeur}</Text>
    </TouchableOpacity>
  );
}

function GroupeChip({
  n, label, color, onPress,
}: {
  n: number;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const actif = n > 0;
  return (
    <TouchableOpacity
      disabled={!actif}
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 4,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
        backgroundColor: C.surfaceAlt, opacity: actif ? 1 : 0.45,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: C.text }}>
        {n} {label}
      </Text>
    </TouchableOpacity>
  );
}
