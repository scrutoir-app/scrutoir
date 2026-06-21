import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { catUI } from "../categoryUI";
import { getParti } from "../api";
import { useFollow } from "../follows";
import type { ProfilParti, PartiCategorie, Periode } from "../types";
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
  const [followed, toggleFollow] = useFollow(uid);

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
        <TouchableOpacity
          onPress={toggleFollow}
          activeOpacity={0.7}
          style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: followed ? C.accent : C.surfaceAlt }}
        >
          <Feather name="bell" size={18} color={followed ? "#fff" : C.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Président·e du groupe */}
      {data.president && (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => nav.push({ name: "depute", uid: data.president!.uid })}
          style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, marginBottom: 12, ...shadowCard }}
        >
          <Image source={{ uri: data.president.photo_url ?? undefined }} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, textTransform: "uppercase", letterSpacing: 0.4 }}>Président·e du groupe</Text>
            <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text, marginTop: 1 }}>{data.president.nom_complet}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.textFaint} />
        </TouchableOpacity>
      )}

      {/* 2 stats (réussite retirée : récompensait l'appartenance à la majorité) */}
      <View style={{ flexDirection: "row", gap: 9, marginBottom: 16 }}>
        <MiniStat valeur={data.cohesion_pct} label="Cohésion" />
        <MiniStat valeur={data.participation_moy_pct} label="Participation" />
      </View>

      {/* Activité parlementaire */}
      <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3, marginBottom: 12 }}>Activité parlementaire</Text>
      <View style={{ flexDirection: "row", gap: 11, marginBottom: 6 }}>
        <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={{ fontFamily: F.extra, fontSize: 22, color: amdColor(data.amendements_ratio), letterSpacing: -0.5 }}>
            {data.amendements.toLocaleString("fr-FR")}
          </Text>
          <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.textMuted, marginTop: 2 }}>Amendements déposés</Text>
          {data.amendements_par_elu != null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint }}>{data.amendements_par_elu}/élu</Text>
              {data.amendements_ratio != null && (
                <View style={{ backgroundColor: amdBg(data.amendements_ratio), paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 11, color: amdColor(data.amendements_ratio) }}>
                    ×{data.amendements_ratio} vs moy.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={{ fontFamily: F.extra, fontSize: 22, color: C.text, letterSpacing: -0.5 }}>
            {data.propositions.toLocaleString("fr-FR")}
          </Text>
          <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.textMuted, marginTop: 2 }}>Propositions de loi</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint, marginTop: 8 }}>déposées par le groupe</Text>
        </View>
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginBottom: 16, lineHeight: 15 }}>
        Un nombre d'amendements/élu très supérieur à la moyenne peut signaler une activité intense… ou de l'obstruction.
      </Text>

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

      <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3, marginBottom: 12 }}>Positions par thème</Text>
      <View style={{ gap: 11 }}>
        {data.categories.map((c) => (
          <PartiThemeRow key={c.id} cat={c} onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })} />
        ))}
      </View>

      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 20, lineHeight: 16 }}>
        Cohésion = part des votes des membres conformes à la consigne du groupe. Participation = moyenne
        des membres. Positions = répartition des votes du groupe par thème. Scrutins publics nominatifs,
        17ᵉ législature.
      </Text>
    </ScrollView>
  );
}

// Couleur du nombre d'amendements selon l'écart à la moyenne (signal d'anomalie).
function amdColor(ratio: number | null): string {
  if (ratio == null) return C.text;
  if (ratio >= 1.5) return C.loyalBas; // rouge : anomalie forte
  if (ratio > 1.0) return C.loyalMoyen; // orange : au-dessus de la moyenne
  return C.text;
}
function amdBg(ratio: number | null): string {
  if (ratio == null) return C.surfaceAlt;
  if (ratio >= 1.5) return C.loyalBasBg;
  if (ratio > 1.0) return C.loyalMoyenBg;
  return C.surfaceAlt;
}

/** Ligne thème (neutre) : répartition des votes du groupe pour/contre/abstention. */
function PartiThemeRow({ cat, onPress }: { cat: PartiCategorie; onPress: () => void }) {
  const ui = catUI(cat.id);
  const tot = (cat.pour + cat.contre + cat.abstention) || 1;
  const seg = (v: number, col: string) => (v ? <View key={col} style={{ flex: v / tot, backgroundColor: col }} /> : null);
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={16} color={ui.fg} />
        </View>
        <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14, color: C.text }}>{cat.libelle}</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </View>
      <View style={{ flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken }}>
        {seg(cat.pour, C.pour)}
        {seg(cat.contre, C.contre)}
        {seg(cat.abstention, C.abstention)}
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textMuted, marginTop: 6 }}>
        {cat.pour} pour · {cat.contre} contre · {cat.abstention} abst.
      </Text>
    </TouchableOpacity>
  );
}

function MiniStat({ valeur, label }: { valeur: number | null; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, alignItems: "center", ...shadowCard }}>
      <Text style={{ fontFamily: F.extra, fontSize: 22, color: C.accent, letterSpacing: -0.5 }}>
        {valeur ?? "—"}<Text style={{ fontFamily: F.bold, fontSize: 12, color: C.textFaint }}>%</Text>
      </Text>
      <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.textMuted, marginTop: 4 }}>{label}</Text>
    </View>
  );
}
