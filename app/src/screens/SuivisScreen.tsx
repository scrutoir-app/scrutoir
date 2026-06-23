import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard, formatDate, positionLabel, couleurPosition } from "../theme";
import { catUI } from "../categoryUI";
import { getVotesSuivis, getPartis } from "../api";
import { useFollows, getLastSeen, markSeen } from "../follows";
import type { VoteSuivi, PartiResume } from "../types";
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
      <Text style={[T.small, { fontFamily: F.bold, color: col }]}>{positionLabel(position)}</Text>
    </View>
  );
}

export function SuivisScreen({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));
  const [items, setItems] = useState<VoteSuivi[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  // Date de la dernière visite, capturée une fois (pour le marquage « nouveau »).
  const lastSeen = useRef(getLastSeen());

  useEffect(() => {
    let alive = true;
    setItems(null);
    getVotesSuivis(deputeUids).then((r) => {
      if (alive) setItems(r);
    });
    if (partiUids.length) {
      getPartis().then((all) => { if (alive) setPartis(all.filter((p) => partiUids.includes(p.uid))); });
    } else {
      setPartis([]);
    }
    return () => { alive = false; };
    // re-charge si la liste des suivis change
  }, [follows.join(",")]);

  // Marque comme vu (au montage) → les « nouveau » d'aujourd'hui ne le seront plus demain.
  useEffect(() => { markSeen(); }, []);

  const isNew = (date: string | null) => !!lastSeen.current && !!date && date > lastSeen.current;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12 }}>
        <Text style={[T.title, { color: C.text }]}>Suivis</Text>
        <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
          Les derniers votes des élus que vous suivez.
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* Partis suivis (raccourci vers leur fiche) */}
      {partis.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.text, marginBottom: 10 }]}>Partis suivis</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingRight: 8 }}>
            {partis.map((p) => (
              <TouchableOpacity
                key={p.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "parti", uid: p.uid })}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, ...shadowCard }}
              >
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: p.couleur ?? C.accent }} />
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
            Vous ne suivez personne pour l'instant
          </Text>
          <Text style={[T.small, { fontFamily: F.regular, color: C.textMuted, marginTop: 6, textAlign: "center" }]}>
            Ouvrez la fiche d'un député et touchez la cloche « Suivre ».
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
        <Text style={[T.small, { color: C.textMuted, marginTop: 24, textAlign: "center" }]}>
          Aucun vote nominatif récent pour ces élus.
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
                    <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>
                      {v.nom}
                    </Text>
                    <Text style={[T.small, { color: C.textFaint, marginTop: 1 }]}>
                      {v.abrev ? v.abrev + " · " : ""}{formatDate(v.date)}
                    </Text>
                  </View>
                  {isNew(v.date) && (
                    <View style={{ backgroundColor: C.accent, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={[T.micro, { fontFamily: F.bold, color: "#fff" }]}>Nouveau</Text>
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
                  <Text style={[T.small, { flex: 1, color: C.text }]} numberOfLines={2}>
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
    </View>
  );
}
