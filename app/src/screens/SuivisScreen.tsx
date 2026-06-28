import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, shadowCard, couleurGroupe } from "../theme";
import { getVotesSuivis, getVotesPartisSuivis, getPartis } from "../api";
import { useFollows, markSeen } from "../follows";
import { useJe } from "../testProximite/jeProximite";
import { CarteSuivi } from "../components/CarteSuivi";
import type { VoteSuivi, PartiResume } from "../types";
import type { Nav } from "../nav";

/**
 * Écran Suivis = flux COMPLET et persistant des suivis (élus + partis). Mêmes cartes que le
 * digest d'accueil (composant partagé CarteSuivi). C'est ici que vit l'exhaustif.
 */
export function SuivisScreen({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const je = useJe();
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);

  useEffect(() => {
    let alive = true;
    setItems(null);
    getPartis().then((all) => { if (alive) setPartis(all); });
    Promise.all([getVotesSuivis(deputeUids), getVotesPartisSuivis(partiUids)]).then(([d, p]) => {
      if (!alive) return;
      const merged = [...d, ...p].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero ?? 0) - (a.numero ?? 0));
      setItems(merged);
    });
    return () => { alive = false; };
  }, [follows.join(",")]);

  // Marque comme vu (au montage) → le digest d'accueil ne re-déroule pas ces votes.
  useEffect(() => { markSeen(); }, []);

  const partisSuivis = partis.filter((p) => partiUids.includes(p.uid));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Suivis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Les derniers votes des élus et groupes que tu suis.
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* Partis suivis (raccourci vers leur fiche) */}
      {partisSuivis.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginBottom: 10 }]}>Partis suivis</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingRight: 8 }}>
            {partisSuivis.map((p) => (
              <TouchableOpacity
                key={p.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "parti", uid: p.uid })}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, ...shadowCard }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: couleurGroupe(p.couleur) }} />
                <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>{p.abrev ?? p.libelle}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Aucun suivi */}
      {follows.length === 0 && (
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 20 }}>
          <MaterialCommunityIcons name="bell-outline" size={40} color={C.textFaint} />
          <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 14, textAlign: "center" }]}>
            Tu ne suis personne pour l'instant
          </Text>
          <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 6, textAlign: "center" }]}>
            Ouvre la fiche d'un député ou d'un groupe et touche la cloche « Suivre ».
            Ses derniers votes apparaîtront ici.
          </Text>
        </View>
      )}

      {/* Chargement */}
      {follows.length > 0 && items === null && (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      )}

      {/* Feed (cartes partagées avec l'accueil) */}
      {follows.length > 0 && items !== null && items.length === 0 && (
        <Text style={[T.small, { color: C.textMuted, marginTop: 24, textAlign: "center" }]}>
          Aucun vote nominatif récent pour tes suivis.
        </Text>
      )}

      {items && items.length > 0 && (
        <View style={{ marginTop: 16, gap: 9 }}>
          {items.map((v) => (
            <CarteSuivi key={v.deputeUid + v.scrutinUid} v={v} partis={partis} je={je} nav={nav} />
          ))}
        </View>
      )}
      </ScrollView>
    </View>
  );
}
