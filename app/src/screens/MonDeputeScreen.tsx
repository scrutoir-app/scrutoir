import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, inputText, RADIUS, shadowCard } from "../theme";
import { AN_DEPUTES_URL } from "../config";
import { getDepartements, getCirconscription, rechercheCommunes } from "../api";
import type { Commune } from "../api";
import type { Departement, DeputeResume } from "../types";
import type { Nav } from "../nav";

export function MonDeputeScreen({ nav }: { nav: Nav }) {
  const [depts, setDepts] = useState<Departement[]>([]);
  const [q, setQ] = useState("");
  const [qFocus, setQFocus] = useState(false); // focus clavier visible sur le champ
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [chercheCommune, setChercheCommune] = useState(false);
  const [parcourir, setParcourir] = useState(false); // repli "par département"
  const [sel, setSel] = useState<Departement | null>(null);
  const [selCommune, setSelCommune] = useState<string | null>(null); // commune choisie (contexte)
  const [elus, setElus] = useState<DeputeResume[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDepartements().then(setDepts).finally(() => setLoading(false));
  }, []);

  // Recherche commune / code postal (API Géo officielle), débouncée.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const s = q.trim();
    if (s.length < 2) { setCommunes([]); return; }
    setChercheCommune(true);
    timer.current = setTimeout(async () => {
      try { setCommunes(await rechercheCommunes(s)); } catch { setCommunes([]); }
      finally { setChercheCommune(false); }
    }, 280);
  }, [q]);

  useEffect(() => {
    if (!sel) { setElus([]); return; }
    getCirconscription(sel.num).then(setElus);
  }, [sel?.num]);

  function choisirCommune(c: Commune) {
    const d = depts.find((x) => x.num === c.codeDepartement);
    if (d) { setSel(d); setSelCommune(c.nom); setQ(""); setCommunes([]); }
  }

  const lienOfficiel = (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => Linking.openURL(AN_DEPUTES_URL)}
      style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}
    >
      <Feather name="external-link" size={14} color={C.accent} />
      <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
        Je ne connais pas ma circonscription ?
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[T.title, { color: C.text }]}>Mon député</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 4 }]}>
        Cherche ta commune ou ton code postal — on t'amène à ton département.
      </Text>

      {loading ? (
        <ActivityIndicator color={C.textMuted} style={{ marginTop: 30 }} />
      ) : sel ? (
        <>
          <TouchableOpacity onPress={() => { setSel(null); setSelCommune(null); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 10 }}>
            <Feather name="chevron-left" size={16} color={C.accent} />
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
              {selCommune ? `${selCommune} · ${sel.nom} (${sel.num})` : `${sel.nom} (${sel.num})`} — changer
            </Text>
          </TouchableOpacity>
          {sel.circos > 1 && (
            <Text style={[T.small, { color: C.textFaint, marginBottom: 10 }]}>
              {sel.circos} circonscriptions dans ce département. Choisis la tienne (le lien officiel ci-dessous
              aide à l'identifier précisément).
            </Text>
          )}
          <View style={{ gap: 9 }}>
            {elus.map((e) => (
              <TouchableOpacity
                key={e.uid}
                activeOpacity={0.7}
                onPress={() => nav.push({ name: "depute", uid: e.uid })}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 11, ...shadowCard }}
              >
                <View style={{ width: 30, alignItems: "center" }}>
                  <Text style={[T.callout, tnum, { fontFamily: F.extra, color: C.accent }]}>{e.circo}</Text>
                  <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>circo</Text>
                </View>
                <Image source={{ uri: e.photo_url ?? undefined }} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.surfaceAlt }} />
                <View style={{ flex: 1 }}>
                  <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{e.nom_complet}</Text>
                  <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>{e.abrev ?? e.groupe ?? "—"}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={C.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
          {lienOfficiel}
        </>
      ) : (
        <>
          {/* Recherche commune / code postal (bordure accent au focus = focus clavier visible) */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, height: 46, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingHorizontal: 14, marginTop: 14, borderWidth: 1, borderColor: qFocus ? C.accent : C.borderStrong }}>
            <Feather name="map-pin" size={17} color={C.textFaint} />
            <TextInput
              value={q}
              onChangeText={setQ}
              onFocus={() => setQFocus(true)}
              onBlur={() => setQFocus(false)}
              placeholder="Ta commune ou code postal…"
              placeholderTextColor={C.textFaint}
              style={[inputText, { flex: 1, color: C.text, outlineStyle: "none" }] as any}
              autoCorrect={false}
            />
            {chercheCommune && <ActivityIndicator size="small" color={C.textFaint} />}
          </View>

          {communes.length > 0 && (
            <View style={{ marginTop: 10, gap: 7 }}>
              {communes.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  activeOpacity={0.7}
                  onPress={() => choisirCommune(c)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 12, ...shadowCard }}
                >
                  <Feather name="map-pin" size={15} color={C.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{c.nom}</Text>
                    <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
                      {c.codesPostaux?.[0] ?? ""} · dépt {c.codeDepartement}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={C.textFaint} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {q.trim().length >= 2 && !chercheCommune && communes.length === 0 && (
            <Text style={[T.small, { color: C.textMuted, marginTop: 14, textAlign: "center" }]}>
              Aucune commune trouvée. Essaie le code postal complet, ou parcours par département.
            </Text>
          )}

          {/* Repli : parcourir par département */}
          <TouchableOpacity onPress={() => setParcourir((p) => !p)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18 }}>
            <Feather name={parcourir ? "chevron-up" : "chevron-down"} size={16} color={C.textMuted} />
            <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Ou parcourir par département</Text>
          </TouchableOpacity>
          {parcourir && (
            <View style={{ marginTop: 10, gap: 8 }}>
              {depts.map((d) => (
                <TouchableOpacity
                  key={d.num}
                  activeOpacity={0.7}
                  onPress={() => setSel(d)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}
                >
                  <Text style={[T.callout, tnum, { fontFamily: F.extra, color: C.accent, width: 34 }]}>{d.num}</Text>
                  <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]}>{d.nom}</Text>
                  <Text style={[T.small, { color: C.textFaint }]}>{d.circos} circo.</Text>
                  <Feather name="chevron-right" size={18} color={C.textFaint} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {lienOfficiel}
        </>
      )}

      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 20 }]}>
        La recherche commune/code postal s'appuie sur l'API Géo officielle (geo.api.gouv.fr) et t'amène
        à ton département. Les grandes villes comptent plusieurs circonscriptions : le lien officiel
        ci-dessus permet d'identifier précisément la tienne.
      </Text>
    </ScrollView>
  );
}
