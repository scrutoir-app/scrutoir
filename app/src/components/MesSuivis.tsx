import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, ScrollView } from "react-native";
import { C, F } from "../theme";
import { getDeputesByUids, getPartis } from "../api";
import { useFollows } from "../follows";
import type { DeputeResume, PartiResume } from "../types";
import type { Nav } from "../nav";

/**
 * Section d'accueil « Mes suivis » : accès rapide aux députés ET partis que
 * L'UTILISATEUR suit (privé, sur son appareil). Distinction par préfixe d'uid
 * (PA… = député, PO… = parti). Se masque si rien n'est suivi.
 */
export function MesSuivis({ nav }: { nav: Nav }) {
  const follows = useFollows();
  const deputeUids = follows.filter((u) => u.startsWith("PA"));
  const partiUids = follows.filter((u) => u.startsWith("PO"));

  const [deps, setDeps] = useState<DeputeResume[]>([]);
  const [partis, setPartis] = useState<PartiResume[]>([]);

  useEffect(() => {
    let alive = true;
    getDeputesByUids(deputeUids).then((r) => { if (alive) setDeps(r); });
    if (partiUids.length) {
      getPartis().then((all) => { if (alive) setPartis(all.filter((p) => partiUids.includes(p.uid))); });
    } else {
      setPartis([]);
    }
    return () => { alive = false; };
  }, [follows.join(",")]);

  if (!deps.length && !partis.length) return null;

  return (
    <View style={{ paddingHorizontal: 18, marginTop: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontFamily: F.extra, fontSize: 16.5, color: C.text, letterSpacing: -0.3 }}>Mes suivis</Text>
        <TouchableOpacity onPress={() => nav.push({ name: "suivis" })}>
          <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Leurs votes ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8 }}>
        {partis.map((p) => (
          <TouchableOpacity
            key={p.uid}
            activeOpacity={0.7}
            onPress={() => nav.push({ name: "parti", uid: p.uid })}
            style={{ alignItems: "center", width: 64 }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: p.couleur ?? C.accent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: F.extra, fontSize: 13, color: "#fff" }}>{p.abrev ?? "?"}</Text>
            </View>
            <Text style={{ fontFamily: F.medium, fontSize: 10.5, color: C.text, marginTop: 5, textAlign: "center" }} numberOfLines={2}>
              {p.abrev ?? p.libelle}
            </Text>
          </TouchableOpacity>
        ))}
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
