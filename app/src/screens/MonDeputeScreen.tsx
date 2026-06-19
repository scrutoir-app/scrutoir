import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { getDepartements, getCirconscription } from "../api";
import type { Departement, DeputeResume } from "../types";
import type { Nav } from "../nav";

export function MonDeputeScreen({ nav }: { nav: Nav }) {
  const [depts, setDepts] = useState<Departement[]>([]);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Departement | null>(null);
  const [elus, setElus] = useState<DeputeResume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDepartements().then(setDepts).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sel) { setElus([]); return; }
    getCirconscription(sel.num).then(setElus);
  }, [sel?.num]);

  const filtres = depts.filter((d) => {
    const s = q.trim().toLowerCase();
    return !s || d.nom?.toLowerCase().includes(s) || d.num.toLowerCase().includes(s);
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <Text style={{ fontFamily: F.extra, fontSize: 20, color: C.text, letterSpacing: -0.4 }}>Mon·ma député·e</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12.5, color: C.textMuted, marginTop: 4, lineHeight: 18 }}>
        Choisissez votre département, puis votre circonscription.
      </Text>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : !sel ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, height: 46, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: C.borderStrong }}>
            <Feather name="search" size={17} color={C.textFaint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Département (nom ou numéro)…"
              placeholderTextColor={C.textFaint}
              style={{ flex: 1, fontSize: 14.5, color: C.text, fontFamily: F.medium, outlineStyle: "none" } as any}
              autoCorrect={false}
            />
          </View>
          <View style={{ marginTop: 12, gap: 8 }}>
            {filtres.map((d) => (
              <TouchableOpacity
                key={d.num}
                activeOpacity={0.7}
                onPress={() => setSel(d)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
              >
                <Text style={{ fontFamily: F.extra, fontSize: 15, color: C.accent, width: 34 }}>{d.num}</Text>
                <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 14.5, color: C.text }}>{d.nom}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textFaint }}>{d.circos} circo.</Text>
                <Feather name="chevron-right" size={18} color={C.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => setSel(null)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 10 }}>
            <Feather name="chevron-left" size={16} color={C.accent} />
            <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.accent }}>{sel.nom} ({sel.num}) — changer</Text>
          </TouchableOpacity>
          <View style={{ gap: 9 }}>
            {elus.map((e) => (
              <TouchableOpacity
                key={e.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "depute", uid: e.uid })}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 11, ...shadowCard }}
              >
                <View style={{ width: 30, alignItems: "center" }}>
                  <Text style={{ fontFamily: F.extra, fontSize: 16, color: C.accent }}>{e.circo}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 9, color: C.textFaint }}>circo</Text>
                </View>
                <Image source={{ uri: e.photo_url ?? undefined }} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 14.5, color: C.text }} numberOfLines={1}>{e.nom_complet}</Text>
                  <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 1 }}>{e.abrev ?? e.groupe ?? "—"}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 20, lineHeight: 16 }}>
        Le rattachement direct par code postal nécessite un référentiel code postal → circonscription
        (à intégrer à la mise en ligne). En attendant, la sélection se fait par département puis numéro
        de circonscription.
      </Text>
    </ScrollView>
  );
}
