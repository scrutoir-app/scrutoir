import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { C, F, RADIUS, shadowCard } from "../theme";
import { getParti } from "../api";
import type { ProfilParti, Periode } from "../types";
import { ReussiteCard } from "../components/ReussiteCard";
import type { Nav } from "../nav";

const PERIODES: { id: Periode; label: string }[] = [
  { id: "all", label: "Depuis 2024" },
  { id: "12m", label: "12 mois" },
  { id: "6m", label: "6 mois" },
];

export function PartiScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [periode, setPeriode] = useState<Periode>("all");
  const [data, setData] = useState<ProfilParti | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    getParti(uid, periode).then((d) => vivant && setData(d)).finally(() => vivant && setLoading(false));
    return () => { vivant = false; };
  }, [uid, periode]);

  if (loading && !data)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return null;

  const p = data.parti;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* En-tête parti */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 16 }}>
        <View style={{ width: 12, height: 54, borderRadius: 6, backgroundColor: p.couleur ?? C.textFaint }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text, letterSpacing: -0.4 }}>{p.abrev ?? p.libelle}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 2 }} numberOfLines={2}>
            {p.libelle} · {p.nb_deputes} élus
          </Text>
        </View>
      </View>

      {/* Réussite globale */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 16, ...shadowCard }}>
        <Text style={{ fontFamily: F.extra, fontSize: 28, color: C.accent, letterSpacing: -0.6 }}>
          {data.reussite_globale_pct ?? "—"}<Text style={{ fontFamily: F.bold, fontSize: 14, color: C.textFaint }}>%</Text>
        </Text>
        <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, lineHeight: 17 }}>
          de réussite — part des scrutins où la ligne du groupe a suivi le résultat (Pour→adopté, Contre→rejeté).
        </Text>
      </View>

      {/* Période */}
      <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12, marginBottom: 16 }}>
        {PERIODES.map((pe) => {
          const actif = pe.id === periode;
          return (
            <TouchableOpacity key={pe.id} onPress={() => setPeriode(pe.id)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}>
              <Text style={{ fontFamily: actif ? F.bold : F.medium, fontSize: 12.5, color: actif ? C.text : C.textMuted }}>{pe.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3, marginBottom: 12 }}>Réussite par thème</Text>
      <View style={{ gap: 11 }}>
        {data.categories.map((c) => (
          <ReussiteCard key={c.id} cat={c} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
        ))}
      </View>

      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 20, lineHeight: 16 }}>
        Réussite calculée sur la consigne de vote du groupe (position majoritaire fournie par l'Assemblée),
        scrutins publics 17ᵉ législature. Les abstentions sont exclues.
      </Text>
    </ScrollView>
  );
}
