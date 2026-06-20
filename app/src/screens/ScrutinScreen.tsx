import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard, formatDate, positionLabel } from "../theme";
import { scrutinSourceUrl } from "../config";
import { getScrutin } from "../api";
import type { DetailScrutin } from "../types";
import type { Nav } from "../nav";

export function ScrutinScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [data, setData] = useState<DetailScrutin | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOuvert, setBriefOuvert] = useState(false);

  useEffect(() => {
    let vivant = true;
    setLoading(true);
    getScrutin(uid).then((d) => vivant && setData(d)).finally(() => vivant && setLoading(false));
    return () => { vivant = false; };
  }, [uid]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color={C.textMuted} />
      </View>
    );
  if (!data) return null;

  const s = data.scrutin;
  const adopte = s.sort_code === "adopte";
  const titreCourt = (s.titre || s.objet || "").slice(0, 80);
  const am = data.amendement;

  const goVotants = (position: string, groupe?: string, groupeLibelle?: string) =>
    nav.push({ name: "votants", scrutinUid: uid, titre: titreCourt, position, groupe, groupeLibelle });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      {/* Bandeau résultat */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: RADIUS.md,
          marginBottom: 14, backgroundColor: adopte ? C.adopteBg : C.rejeteBg,
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: adopte ? C.pour : C.contre, alignItems: "center", justifyContent: "center" }}>
          <Feather name={adopte ? "check" : "x"} size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.extra, fontSize: 17, color: adopte ? C.adopteFg : C.rejeteFg }}>
            {adopte ? "Adopté" : "Rejeté"}
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 1 }}>
            {s.sort_libelle ?? (adopte ? "L'Assemblée nationale a adopté" : "L'Assemblée nationale n'a pas adopté")}
          </Text>
        </View>
      </View>

      <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text, lineHeight: 22 }}>{s.titre || s.objet}</Text>
      <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.textMuted, marginTop: 6 }}>
        {formatDate(s.date)} · scrutin n° {s.numero}
      </Text>

      {/* Lien source : page publique du scrutin sur l'Assemblée Nationale */}
      {scrutinSourceUrl(s.numero) && (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => Linking.openURL(scrutinSourceUrl(s.numero)!)}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" }}
        >
          <Feather name="external-link" size={13} color={C.accent} />
          <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.accent }}>
            Voir le scrutin sur assemblee-nationale.fr
          </Text>
        </TouchableOpacity>
      )}

      {/* Résumé du texte (exposé de l'amendement) — visible par défaut */}
      {am && (am.expose || am.dispositif) && (
        <View style={{ marginTop: 16, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: C.text }}>Résumé du texte</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 2 }} numberOfLines={2}>
            Exposé de l'amendement{am.numero ? ` n° ${am.numero}` : ""}{am.article ? ` · ${am.article}` : ""}
            {am.auteur ? ` · ${am.auteur}` : ""}
          </Text>

          {!briefOuvert ? (
            <>
              <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.text, lineHeight: 19, marginTop: 9 }} numberOfLines={5}>
                {am.expose || am.dispositif}
              </Text>
              {((am.expose || "").length > 220 || !!am.dispositif) && (
                <TouchableOpacity onPress={() => setBriefOuvert(true)} style={{ marginTop: 8 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Lire en entier ▾</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {!!am.dispositif && <Bloc titre="Ce que l'amendement modifie" texte={am.dispositif} />}
              {!!am.expose && <Bloc titre="Justification de l'auteur" texte={am.expose} />}
              <TouchableOpacity onPress={() => setBriefOuvert(false)} style={{ marginTop: 10 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Replier ▴</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Intitulé officiel du dossier législatif (loi entière, motion…) quand il n'y a
          pas d'amendement à exposer. Source : titreDossier.titre de l'Open Data AN. */}
      {!(am && (am.expose || am.dispositif)) && !!s.dossier_titre && (
        <View style={{ marginTop: 16, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13.5, color: C.text }}>Objet du texte</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 2 }}>
            Intitulé officiel du dossier législatif
          </Text>
          <Text style={{ fontFamily: F.regular, fontSize: 13.5, color: C.text, lineHeight: 20, marginTop: 9 }}>
            {s.dossier_titre}
          </Text>
        </View>
      )}

      {/* Chiffres */}
      <View style={{ flexDirection: "row", gap: 9, marginTop: 16 }}>
        <Chiffre label="Pour" valeur={s.pour} color={C.pour} onPress={() => goVotants("pour")} />
        <Chiffre label="Contre" valeur={s.contre} color={C.contre} onPress={() => goVotants("contre")} />
        <Chiffre label="Abst." valeur={s.abstention} color={C.abstention} onPress={() => goVotants("abstention")} />
      </View>
      <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 7 }}>
        Touchez un chiffre pour voir qui a voté.
      </Text>

      <Text style={{ fontFamily: F.extra, fontSize: 15, color: C.text, marginTop: 22, marginBottom: 11 }}>Position par groupe</Text>

      <View style={{ gap: 11 }}>
        {data.groupes.map((g) => {
          const nom = g.abrev ?? g.libelle;
          const cells = [
            { pos: "pour", n: g.pour, label: "Pour", color: C.pour },
            { pos: "contre", n: g.contre, label: "Contre", color: C.contre },
            { pos: "abstention", n: g.abstention, label: "Abst.", color: C.abstention },
            { pos: "nonvotant", n: g.absent, label: "Absent", color: C.textFaint },
          ];
          return (
            <View key={g.uid} style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }} numberOfLines={1}>{nom}</Text>
                <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.textMuted }}>
                  consigne : <Text style={{ fontFamily: F.bold, color: C.text }}>{positionLabel(g.consigne)}</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 7 }}>
                {cells.map((c) => (
                  <TouchableOpacity
                    key={c.pos}
                    activeOpacity={0.6}
                    disabled={c.n === 0}
                    onPress={() => goVotants(c.pos, g.uid, nom)}
                    style={{ flex: 1, backgroundColor: C.surfaceSunken, borderRadius: 10, paddingVertical: 8, alignItems: "center", opacity: c.n === 0 ? 0.5 : 1 }}
                  >
                    <Text style={{ fontFamily: F.extra, fontSize: 16, color: c.color }}>{c.n}</Text>
                    <Text style={{ fontFamily: F.semibold, fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function Bloc({ titre, texte }: { titre: string; texte: string }) {
  return (
    <>
      <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: C.textMuted, marginTop: 12, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {titre}
      </Text>
      <Text style={{ fontFamily: F.regular, fontSize: 13, color: C.text, lineHeight: 19 }}>{texte}</Text>
    </>
  );
}

function Chiffre({ label, valeur, color, onPress }: { label: string; valeur: number; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      disabled={valeur === 0}
      onPress={onPress}
      activeOpacity={0.6}
      style={{ flex: 1, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, opacity: valeur === 0 ? 0.5 : 1, ...shadowCard }}
    >
      <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.textMuted }}>{label}</Text>
      <Text style={{ fontFamily: F.extra, fontSize: 23, color, marginTop: 2, letterSpacing: -0.5 }}>{valeur}</Text>
    </TouchableOpacity>
  );
}
