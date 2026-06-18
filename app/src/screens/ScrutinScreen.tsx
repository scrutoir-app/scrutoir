import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { C, formatDate, positionLabel } from "../theme";
import { getScrutin } from "../api";
import type { DetailScrutin } from "../types";
import { VoteBar } from "../components/VoteBar";

export function ScrutinScreen({ uid }: { uid: string }) {
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

      <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 8 }}>
        <Chiffre label="Pour" valeur={s.pour} color={C.pour} />
        <Chiffre label="Contre" valeur={s.contre} color={C.contre} />
        <Chiffre label="Abst." valeur={s.abstention} color={C.abstention} />
      </View>

      <Text style={{ fontSize: 12, color: C.textMuted, fontWeight: "500", marginTop: 18, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Position par groupe
      </Text>

      {data.groupes.map((g) => (
        <View key={g.uid} style={{ paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 14, color: C.text, flex: 1 }} numberOfLines={1}>
              {g.abrev ?? g.libelle}
            </Text>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              consigne : <Text style={{ color: C.text }}>{positionLabel(g.consigne)}</Text>
            </Text>
          </View>
          <VoteBar pour={g.pour} contre={g.contre} abstention={g.abstention} absent={g.absent} height={7} />
          <Text style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>
            {g.pour} pour · {g.contre} contre · {g.abstention} abst. · {g.absent} absent
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Chiffre({ label, valeur, color }: { label: string; valeur: number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surfaceAlt, borderRadius: 8, padding: 12 }}>
      <Text style={{ fontSize: 12, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "500", color, marginTop: 2 }}>{valeur}</Text>
    </View>
  );
}
