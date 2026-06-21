import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { getTrends } from "../api";
import type { Trends, DeputeResume } from "../types";
import type { Nav } from "../nav";

/**
 * Section « Tendances » de l'accueil : ce que regardent les visiteurs (duels
 * populaires, élu·e·s les plus suivi·e·s). Données agrégées et anonymes (Worker
 * analytics). Se masque tant qu'il n'y a pas assez de données réelles.
 */
function Avatar({ d, size = 40 }: { d: DeputeResume; size?: number }) {
  return (
    <Image
      source={{ uri: d.photo_url ?? undefined }}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceAlt }}
    />
  );
}

export function Tendances({ nav }: { nav: Nav }) {
  const [t, setT] = useState<Trends | null>(null);
  useEffect(() => {
    let alive = true;
    getTrends().then((r) => { if (alive) setT(r); });
    return () => { alive = false; };
  }, []);

  if (!t) return null;

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 22 }}>
      <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3 }}>Tendances</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 3, marginBottom: 12 }}>
        Ce que regardent les visiteurs en ce moment
      </Text>

      {t.duels.length > 0 && (
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.text, marginBottom: 8 }}>🔥 Duels populaires</Text>
          {t.duels.slice(0, 3).map((d, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => nav.push({ name: "confrontation", a: d.a.uid, b: d.b.uid })}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 10, marginBottom: 8, ...shadowCard }}
            >
              <View style={{ flexDirection: "row" }}>
                <Avatar d={d.a} size={34} />
                <View style={{ marginLeft: -10 }}><Avatar d={d.b} size={34} /></View>
              </View>
              <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 13, color: C.text }} numberOfLines={2}>
                {d.a.nom_complet} <Text style={{ color: C.textFaint }}>✕</Text> {d.b.nom_complet}
              </Text>
              <Feather name="chevron-right" size={18} color={C.textFaint} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {t.suivis.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.text, marginBottom: 10 }}>⭐ Les plus suivi·e·s</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8 }}>
            {t.suivis.slice(0, 8).map((s) => (
              <TouchableOpacity
                key={s.depute.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "depute", uid: s.depute.uid })}
                style={{ alignItems: "center", width: 64 }}
              >
                <Avatar d={s.depute} size={52} />
                <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.text, marginTop: 5, textAlign: "center" }} numberOfLines={2}>
                  {s.depute.nom_complet}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
