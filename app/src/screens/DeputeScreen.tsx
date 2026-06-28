import React, { useEffect, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { getProfil } from "../api";
import type { ProfilDepute, Periode } from "../types";
import { CategoryVoteCard } from "../components/CategoryVoteCard";
import { ProximiteDeputeBadge } from "../components/BadgeProximite";
import { useFollow } from "../follows";
import type { Nav } from "../nav";

const PERIODES: { id: Periode; label: string }[] = [
  { id: "all", label: "Depuis 2024" },
  { id: "12m", label: "12 mois" },
  { id: "6m", label: "6 mois" },
];

export function DeputeScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [periode, setPeriode] = useState<Periode>("all");
  const [profil, setProfil] = useState<ProfilDepute | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [followed, toggleFollow] = useFollow(uid);

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    getProfil(uid, periode)
      .then((p) => vivant && setProfil(p))
      .finally(() => vivant && setLoading(false));
    return () => { vivant = false; };
  }, [uid, periode]);

  if (loading && !profil)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!profil) return null;

  const { depute: d, participation_pct, participation_rang_pct, categories } = profil;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* En-tête */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 16 }}>
        <Image source={{ uri: d.photo_url ?? undefined }} style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: C.surfaceAlt }} />
        <View style={{ flex: 1 }}>
          <Text style={[T.title, { color: C.text }]}>{d.nom_complet}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start", backgroundColor: C.surfaceAlt, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: couleurGroupe(d.couleur) }} />
            <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{d.abrev ?? d.groupe ?? "—"}</Text>
          </View>
          {!!d.departement && d.circo && (
            <Text style={[T.small, { color: C.textFaint, marginTop: 5 }]}>
              {d.departement} · {d.circo}ᵉ circonscription
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={toggleFollow}
          activeOpacity={0.7}
          style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: followed ? C.accent : C.surfaceAlt }}
        >
          <Feather name="bell" size={18} color={followed ? "#fff" : C.textMuted} />
        </TouchableOpacity>
      </View>
      {followed && (
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: -8, marginBottom: 14 }]}>
          Suivi — notifications de nouveaux votes à l'arrivée de la version en ligne.
        </Text>
      )}

      {/* « Tu votes comme X% » de cet élu — issu du test de proximité (rien sans « je »). */}
      <ProximiteDeputeBadge uid={d.uid} couleur={d.couleur} />

      {/* Participation (relative) — pas de score de loyauté agrégé (cf. consigne par scrutin) */}
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, marginBottom: 16, ...shadowCard }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>Participation aux scrutins</Text>
          <Text style={[T.title, tnum, { color: C.text }]}>
            {participation_pct ?? "—"}<Text style={[T.small, { fontFamily: F.bold, color: C.textFaint }]}>%</Text>
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surfaceSunken, overflow: "hidden", marginTop: 9 }}>
          <View style={{ width: `${participation_rang_pct ?? 0}%`, height: "100%", backgroundColor: C.accent }} />
        </View>
        <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 7 }]}>
          {participation_rang_pct != null ? `Plus assidu que ${participation_rang_pct} % des députés (scrutins nominatifs)` : "scrutins publics nominatifs votés"}
        </Text>
      </View>

      {/* Période */}
      <View style={{ flexDirection: "row", gap: 4, padding: 4, backgroundColor: C.surfaceAlt, borderRadius: 12, marginBottom: 16 }}>
        {PERIODES.map((p) => {
          const actif = p.id === periode;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setPeriode(p.id)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center", backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}
            >
              <Text style={[T.small, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bouton dissidences */}
      <TouchableOpacity
        onPress={() => nav.push({ name: "dissidences", uid: d.uid, nom: d.nom_complet })}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, marginBottom: 18, ...shadowCard }}
      >
        <Feather name="git-branch" size={18} color={C.accent} />
        <Text style={[T.body, { flex: 1, fontFamily: F.semibold, color: C.text }]}>Voir les dissidences</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </TouchableOpacity>

      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginBottom: 12 }]}>
        Votes par thème
      </Text>

      <View style={{ gap: 11 }}>
        {categories.map((c) => (
          <CategoryVoteCard
            key={c.id}
            cat={c}
            ouvert={!!expanded[c.id]}
            onToggle={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}
            onTitle={() => nav.push({ name: "votesCategorie", uid: d.uid, nom: d.nom_complet, categorie: c.id, categorieLibelle: c.libelle, periode })}
            onCell={(position) =>
              nav.push({ name: "votesDepute", uid: d.uid, nom: d.nom_complet, categorie: c.id, categorieLibelle: c.libelle, position })
            }
          />
        ))}
      </View>

      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 20 }]}>
        Scrutins publics nominatifs de l'Assemblée Nationale (17ᵉ législature) — la majorité des votes
        se tiennent à main levée et n'apparaissent pas ici. « Absent » = aucune trace de vote sur le
        scrutin (déduit) ; « Non votant » = présent sans prendre part. La consigne du groupe est
        indiquée sur chaque scrutin (voir les dissidences pour les écarts).
      </Text>
    </ScrollView>
  );
}
