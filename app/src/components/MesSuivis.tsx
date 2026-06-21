import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { C, F } from "../theme";
import { getDeputesByUids } from "../api";
import { useFollows } from "../follows";
import type { DeputeResume } from "../types";
import type { Nav } from "../nav";

/**
 * Section d'accueil « Mes élu·e·s suivi·e·s » : accès rapide aux député·e·s que
 * L'UTILISATEUR suit (privé, stocké sur son appareil). Se masque s'il n'en suit aucun.
 */
export function MesSuivis({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const [deps, setDeps] = useState<DeputeResume[]>([]);

  useEffect(() => {
    let alive = true;
    getDeputesByUids(follows).then((r) => { if (alive) setDeps(r); });
    return () => { alive = false; };
  }, [follows.join(",")]);

  if (!follows.length || !deps.length) return null;

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3 }}>Mes élu·e·s suivi·e·s</Text>
        <TouchableOpacity onPress={() => nav.push({ name: "suivis" })}>
          <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Leurs votes ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8 }}>
        {deps.map((d) => (
          <TouchableOpacity
            key={d.uid}
            activeOpacity={0.7}
            onPress={() => nav.push({ name: "depute", uid: d.uid })}
            style={{ alignItems: "center", width: 64 }}
          >
            <Image
              source={{ uri: d.photo_url ?? undefined }}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.surfaceAlt }}
            />
            <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.text, marginTop: 5, textAlign: "center" }} numberOfLines={2}>
              {d.nom_complet}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
