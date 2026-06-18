import React, { useEffect, useState } from "react";
import {
  View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { C, couleurLoyaute, libelleLoyaute } from "../theme";
import { getProfil } from "../api";
import type { ProfilDepute, Periode } from "../types";
import { VoteBar } from "../components/VoteBar";
import { LoyautePill } from "../components/LoyauteBadge";
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

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    getProfil(uid, periode)
      .then((p) => vivant && setProfil(p))
      .finally(() => vivant && setLoading(false));
    return () => {
      vivant = false;
    };
  }, [uid, periode]);

  if (loading && !profil)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!profil) return null;

  const { depute: d, loyaute_globale_pct, categories } = profil;
  const loy = couleurLoyaute(loyaute_globale_pct);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <Image
          source={{ uri: d.photo_url ?? undefined }}
          style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.surfaceAlt }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 19, fontWeight: "500", color: C.text }}>{d.nom_complet}</Text>
          <View
            style={{
              alignSelf: "flex-start", marginTop: 5, backgroundColor: (d.couleur ?? C.accent) + "22",
              paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: C.text }}>{d.abrev ?? d.groupe ?? "—"}</Text>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
          backgroundColor: loy.bg, borderRadius: 10, marginBottom: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: loy.fg, fontWeight: "500" }}>
            {libelleLoyaute(loyaute_globale_pct)}
          </Text>
          <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            Conformité à la consigne de vote du groupe
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: "500", color: loy.fg }}>
          {loyaute_globale_pct ?? "—"}%
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => nav.push({ name: "dissidences", uid: d.uid, nom: d.nom_complet })}
        style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingVertical: 11, paddingHorizontal: 12, marginBottom: 16,
          borderWidth: 0.5, borderColor: C.border, borderRadius: 10, backgroundColor: C.surface,
        }}
      >
        <Text style={{ fontSize: 14, color: C.text }}>
          Voir les dissidences (votes contre la consigne)
        </Text>
        <Text style={{ color: C.textFaint, fontSize: 18 }}>›</Text>
      </TouchableOpacity>

      <View
        style={{
          flexDirection: "row", gap: 4, padding: 3, backgroundColor: C.surfaceAlt,
          borderRadius: 10, marginBottom: 16,
        }}
      >
        {PERIODES.map((p) => {
          const actif = p.id === periode;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => setPeriode(p.id)}
              style={{
                flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: "center",
                backgroundColor: actif ? C.surface : "transparent",
                borderWidth: actif ? 0.5 : 0, borderColor: C.border,
              }}
            >
              <Text style={{ fontSize: 12, color: actif ? C.text : C.textMuted }}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Legende />

      {categories.map((c) => {
        const exprimes = c.pour + c.contre;
        const pctPour = exprimes ? Math.round((c.pour / exprimes) * 100) : 0;
        const goVotes = (position: string) =>
          nav.push({
            name: "votesDepute",
            uid: d.uid,
            nom: d.nom_complet,
            categorie: c.id,
            categorieLibelle: c.libelle,
            position,
          });
        return (
          <View key={c.id} style={{ paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: C.border }}>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => nav.push({ name: "categorie", id: c.id, libelle: c.libelle })}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}
            >
              <Text style={{ fontSize: 14, color: C.text, flex: 1 }}>
                {c.emoji} {c.libelle}
              </Text>
              <LoyautePill pct={c.loyaute_pct} />
            </TouchableOpacity>
            <VoteBar pour={c.pour} contre={c.contre} abstention={c.abstention} absent={c.absent} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
              <CountChip n={c.pour} label="pour" color={C.pour} onPress={() => goVotes("pour")} />
              <CountChip n={c.contre} label="contre" color={C.contre} onPress={() => goVotes("contre")} />
              <CountChip n={c.abstention} label="abst." color={C.abstention} onPress={() => goVotes("abstention")} />
              <CountChip n={c.absent} label="absent" color={C.absent} onPress={() => goVotes("nonvotant")} />
              <Text style={{ fontSize: 11, color: C.textFaint, alignSelf: "center", marginLeft: 2 }}>
                · {pctPour}% pour
              </Text>
            </View>
          </View>
        );
      })}

      <Text style={{ fontSize: 11, color: C.textFaint, marginTop: 20, lineHeight: 16 }}>
        Données : scrutins publics de l'Assemblée Nationale (17ᵉ législature). Seuls les votes
        nominatifs sont comptabilisés. La loyauté compare chaque vote à la consigne du groupe.
      </Text>
    </ScrollView>
  );
}

function CountChip({
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
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
        backgroundColor: C.surfaceAlt, opacity: actif ? 1 : 0.5,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: C.text }}>
        {n} {label}
      </Text>
    </TouchableOpacity>
  );
}

function Legende() {
  const item = (color: string, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: C.textMuted }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
      {item(C.pour, "Pour")}
      {item(C.contre, "Contre")}
      {item(C.abstention, "Abstention")}
      {item(C.absent, "Absent")}
    </View>
  );
}
