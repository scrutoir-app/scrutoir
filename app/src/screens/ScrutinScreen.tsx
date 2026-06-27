import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, formatDate, positionLabel } from "../theme";
import { scrutinSourceUrl } from "../config";
import { getScrutin } from "../api";
import { track } from "../analytics";
import type { DetailScrutin } from "../types";
import type { Nav } from "../nav";
import { ParcoursLoi } from "../components/ParcoursLoi";

export function ScrutinScreen({ uid, nav }: { uid: string; nav: Nav }) {
  const [data, setData] = useState<DetailScrutin | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefOuvert, setBriefOuvert] = useState(false);
  const [parcours, setParcours] = useState(false);

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
          <Text style={[T.heading, { fontFamily: F.extra, color: adopte ? C.adopteFg : C.rejeteFg }]}>
            {adopte ? "Adopté" : "Rejeté"}
          </Text>
          <Text style={[T.small, { color: C.textMuted, marginTop: 1 }]}>
            {s.sort_libelle ?? (adopte ? "L'Assemblée nationale a adopté" : "L'Assemblée nationale n'a pas adopté")}
          </Text>
        </View>
      </View>

      <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]}>{s.titre || s.objet}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
        <Text style={[T.small, tnum, { color: C.textMuted }]}>
          {formatDate(s.date)} · scrutin n° {s.numero}
        </Text>
        <TouchableOpacity
          onPress={() => setParcours(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Qu'est-ce qu'un scrutin ? Voir le parcours d'une loi"
        >
          <Feather name="info" size={14} color={C.accent} />
        </TouchableOpacity>
      </View>
      <ParcoursLoi visible={parcours} onClose={() => setParcours(false)} source="scrutin" />

      {/* Lien source : page publique du scrutin sur l'Assemblée Nationale */}
      {scrutinSourceUrl(s.numero) && (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => { track("source", String(s.numero ?? "")); Linking.openURL(scrutinSourceUrl(s.numero)!); }}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start" }}
        >
          <Feather name="external-link" size={13} color={C.accent} />
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
            Voir le scrutin sur assemblee-nationale.fr
          </Text>
        </TouchableOpacity>
      )}

      {/* Résumé du texte (exposé de l'amendement) — visible par défaut */}
      {am && (am.expose || am.dispositif) && (
        <View style={{ marginTop: 16, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Résumé du texte</Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 2 }]} numberOfLines={2}>
            Exposé de l'amendement{am.numero ? ` n° ${am.numero}` : ""}{am.article ? ` · ${am.article}` : ""}
            {am.auteur ? ` · ${am.auteur}` : ""}
          </Text>

          {!briefOuvert ? (
            <>
              <Text style={[T.small, { fontFamily: F.regular, color: C.text, marginTop: 9 }]} numberOfLines={5}>
                {am.expose || am.dispositif}
              </Text>
              {((am.expose || "").length > 220 || !!am.dispositif) && (
                <TouchableOpacity onPress={() => setBriefOuvert(true)} style={{ marginTop: 8 }}>
                  <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Lire en entier ▾</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              {!!am.dispositif && <Bloc titre="Ce que l'amendement modifie" texte={am.dispositif} />}
              {!!am.expose && <Bloc titre="Justification de l'auteur" texte={am.expose} />}
              <TouchableOpacity onPress={() => setBriefOuvert(false)} style={{ marginTop: 10 }}>
                <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Replier ▴</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Intitulé officiel du dossier législatif (loi entière, motion…) quand il n'y a
          pas d'amendement à exposer. Source : titreDossier.titre de l'Open Data AN. */}
      {!(am && (am.expose || am.dispositif)) && !!s.dossier_titre && (
        <View style={{ marginTop: 16, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, ...shadowCard }}>
          <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>Objet du texte</Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 2 }]}>
            Intitulé officiel du dossier législatif
          </Text>
          <Text style={[T.body, { fontFamily: F.regular, color: C.text, marginTop: 9 }]}>
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
      <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint, marginTop: 7 }]}>
        Touche un chiffre pour voir qui a voté.
      </Text>

      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 22, marginBottom: 11 }]}>Position par groupe</Text>

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
                <Text style={[T.body, { fontFamily: F.bold, color: C.text }]} numberOfLines={1}>{nom}</Text>
                <Text style={[T.small, { color: C.textMuted }]}>
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
                    <Text style={[T.callout, tnum, { fontFamily: F.extra, color: c.color }]}>{c.n}</Text>
                    <Text style={[T.micro, { color: C.textMuted, marginTop: 2 }]}>{c.label}</Text>
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
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, marginTop: 12, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }]}>
        {titre}
      </Text>
      <Text style={[T.small, { fontFamily: F.regular, color: C.text }]}>{texte}</Text>
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
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{label}</Text>
      <Text style={[T.title, tnum, { color, marginTop: 2 }]}>{valeur}</Text>
    </TouchableOpacity>
  );
}
