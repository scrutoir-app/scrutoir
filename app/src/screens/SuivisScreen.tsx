import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition } from "../theme";
import { catUI } from "../categoryUI";
import { getVotesSuivis } from "../api";
import { useFollows, getLastSeen, markSeen } from "../follows";
import type { VoteSuivi } from "../types";
import type { Nav } from "../nav";

function Avatar({ uri, couleur, size = 34 }: { uri: string | null; couleur: string | null; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surfaceSunken }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: (couleur || C.accent) + "22", alignItems: "center", justifyContent: "center" }}>
      <MaterialCommunityIcons name="account" size={size * 0.6} color={couleur || C.accent} />
    </View>
  );
}

function PositionPill({ position }: { position: string }) {
  const col = couleurPosition(position);
  return (
    <View style={{ backgroundColor: col + "1F", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: col }}>{positionLabel(position)}</Text>
    </View>
  );
}

export function SuivisScreen({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  // Date de la dernière visite, capturée une fois (pour le marquage « nouveau »).
  const lastSeen = useRef(getLastSeen());

  useEffect(() => {
    let alive = true;
    setItems(null);
    getVotesSuivis(follows).then((r) => {
      if (alive) setItems(r);
    });
    return () => { alive = false; };
    // re-charge si la liste des suivis change
  }, [follows.join(",")]);

  // Marque comme vu (au montage) → les « nouveau » d'aujourd'hui ne le seront plus demain.
  useEffect(() => { markSeen(); }, []);

  const isNew = (date: string | null) => !!lastSeen.current && !!date && date > lastSeen.current;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 23, color: C.text, letterSpacing: -0.6 }}>Suivis</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 4 }}>
        Les derniers votes des élu·e·s que vous suivez.
      </Text>

      {/* Aucun suivi */}
      {follows.length === 0 && (
        <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 20 }}>
          <MaterialCommunityIcons name="bell-outline" size={40} color={C.textFaint} />
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text, marginTop: 14, textAlign: "center" }}>
            Vous ne suivez personne pour l'instant
          </Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.textMuted, marginTop: 6, textAlign: "center", lineHeight: 19 }}>
            Ouvrez la fiche d'un·e député·e et touchez la cloche « Suivre ».
            Ses derniers votes apparaîtront ici.
          </Text>
        </View>
      )}

      {/* Chargement */}
      {follows.length > 0 && items === null && (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      )}

      {/* Feed */}
      {follows.length > 0 && items !== null && items.length === 0 && (
        <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.textMuted, marginTop: 24, textAlign: "center" }}>
          Aucun vote nominatif récent pour ces élu·e·s.
        </Text>
      )}

      {items && items.length > 0 && (
        <View style={{ marginTop: 16, gap: 9 }}>
          {items.map((v) => {
            const cat = v.categorie ? catUI(v.categorie) : null;
            return (
              <TouchableOpacity
                key={v.deputeUid + v.scrutinUid}
                activeOpacity={0.6}
                onPress={() => nav.push({ name: "scrutin", uid: v.scrutinUid })}
                style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, ...shadowCard }}
              >
                {/* En-tête : élu + date (+ badge nouveau) */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <TouchableOpacity onPress={() => nav.push({ name: "depute", uid: v.deputeUid })} activeOpacity={0.6}>
                    <Avatar uri={v.photo} couleur={v.couleur} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: C.text }} numberOfLines={1}>
                      {v.nom}
                    </Text>
                    <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint, marginTop: 1 }}>
                      {v.abrev ? v.abrev + " · " : ""}{formatDate(v.date)}
                    </Text>
                  </View>
                  {isNew(v.date) && (
                    <View style={{ backgroundColor: C.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 10, color: "#fff" }}>Nouveau</Text>
                    </View>
                  )}
                </View>

                {/* Scrutin + position */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 }}>
                  {cat && (
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: cat.bg, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name={cat.icon as any} size={15} color={cat.fg} />
                    </View>
                  )}
                  <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 13, color: C.text, lineHeight: 18 }} numberOfLines={2}>
                    {v.titre}
                  </Text>
                  <PositionPill position={v.position} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
