import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T } from "../theme";
import { Card } from "../components/ui";
import { getDeputesParti } from "../api";
import type { DeputeResume } from "../types";
import type { Nav } from "../nav";

/** Liste de tous les élus actifs d'un groupe, depuis la fiche parti. */
export function MembresPartiScreen({ uid, libelle, nav }: { uid: string; libelle: string; nav: Nav }) {
  const [deps, setDeps] = useState<DeputeResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeputesParti(uid).then(setDeps).finally(() => setLoading(false));
  }, [uid]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.title, { color: C.text }]}>{libelle}</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 1, marginBottom: 14 }]}>
        {loading ? "…" : `${deps.length} élus`}
      </Text>
      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : (
        deps.map((d) => (
          <Card
            key={d.uid}
            onPress={() => nav.push({ name: "depute", uid: d.uid })}
            padding={11}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 9 }}
          >
            <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
            <View style={{ flex: 1 }}>
              <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{d.nom_complet}</Text>
              {!!(d.departement || d.circo) && (
                <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]} numberOfLines={1}>
                  {[d.departement, d.circo ? `${d.circo}ᵉ circo` : null].filter(Boolean).join(" · ")}
                </Text>
              )}
            </View>
            <Feather name="chevron-right" size={20} color={C.textFaint} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}
