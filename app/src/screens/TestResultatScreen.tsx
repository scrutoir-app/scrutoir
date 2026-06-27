import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { calculerProximite } from "../testProximite/score";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";
import { sauverTest, urlPartage } from "../testProximite/storage";

const NIVEAUX = [
  { label: "Peu", v: 0.5 },
  { label: "Normal", v: 1 },
  { label: "Fort", v: 2 },
];

/** hex → rgba avec alpha (teinte de la matrice à l'opacité de la proximité). */
function rgba(hex: string | null | undefined, a: number): string {
  if (!hex) return `rgba(140,150,165,${a})`;
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Partage 100 % client (geste explicite de l'utilisateur). Le message vu côté destinataire
// est « Voici mon résultat … et toi ? » : le « et toi ? » est le ressort qui invite à faire
// le test. Style neutre, aucune couleur de parti, aucune donnée d'usage dans le lien (l'URL
// n'encode que les réponses/poids, recalculés à l'ouverture — cf. urlPartage/encoderPartage).
async function partager(url: string, texte: string): Promise<"shared" | "copied" | "manual"> {
  try {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) { await nav.share({ title: "Test de proximité — Scrutoir", text: texte, url }); return "shared"; }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(`${texte}\n${url}`); return "copied"; }
  } catch { /* annulé / indisponible */ }
  return "manual";
}

export function TestResultatScreen({
  reponses,
  poids: poidsInitial,
  nav,
}: {
  reponses: Record<number, Reponse>;
  themesJoues?: string[];
  poids?: Record<string, number>;
  nav: Nav;
}) {
  const [all, setAll] = useState<QuestionProximite[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [poids, setPoids] = useState<Record<string, number>>({});
  const [partageMsg, setPartageMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getTestProximite(), getPartis(), getCategories()]).then(([qs, ps, cs]) => {
      setAll(qs); setPartis(ps); setCats(cs);
    });
  }, []);

  // Questions réellement répondues + thèmes joués (dérivés → vaut pour un lien partagé aussi).
  const jouees = useMemo(() => (all ? all.filter((q) => reponses[q.id] != null) : []), [all, reponses]);
  const themes = useMemo(() => [...new Set(jouees.map((q) => q.theme))].sort(), [jouees]);

  // Initialise les poids (lien partagé > défaut 1) une fois les thèmes connus.
  useEffect(() => {
    if (!themes.length) return;
    setPoids((prev) => (Object.keys(prev).length ? prev : Object.fromEntries(themes.map((t) => [t, poidsInitial?.[t] ?? 1]))));
  }, [themes.join("|")]);

  const groupes = useMemo(() => partis.filter((p) => p.abrev).map((p) => ({ abrev: p.abrev! })), [partis]);
  const resultat = useMemo(
    () => (jouees.length && groupes.length ? calculerProximite(jouees, reponses, poids, groupes) : null),
    [jouees, reponses, poids, groupes]
  );

  // Persistance locale (rien côté serveur) dès qu'on a un état complet.
  useEffect(() => {
    if (jouees.length && Object.keys(poids).length) sauverTest({ reponses, poids });
  }, [reponses, poids, jouees.length]);

  if (!resultat) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const couleur = (abrev: string) => partis.find((p) => p.abrev === abrev)?.couleur ?? C.textFaint;
  const libelle = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  const comparableTotal = (abrev: string) =>
    themes.reduce((s, t) => s + (resultat.parTheme[t]?.[abrev]?.comparable ?? 0), 0);
  const nbVotes = Object.values(reponses).filter((r) => r === "pour" || r === "contre").length;

  // Colonnes de la matrice : groupes présents, dans l'ordre gauche→droite.
  const colonnes = ORDRE_HEMICYCLE.filter((a) => partis.some((p) => p.abrev === a));

  // Résumé NEUTRE et honnête : le groupe le plus proche, seulement s'il est fiable
  // (≥ 2 votes comparés, comme la matrice). Sinon, message sans groupe (pas de faux verdict).
  const resumePartage = (): string => {
    const top = [...resultat.global]
      .filter((g) => comparableTotal(g.abrev) >= 2)
      .sort((a, b) => b.pct - a.pct)[0];
    return top
      ? `Voici mon résultat : proche du groupe ${top.abrev} à ${Math.round(top.pct * 100)} %. Et toi ?`
      : `Voici mon résultat au test de proximité Scrutoir. Et toi ?`;
  };

  const onShare = async () => {
    const r = await partager(urlPartage(reponses, poids), resumePartage());
    setPartageMsg(r === "copied" ? "Lien copié !" : r === "shared" ? null : "Copie indisponible");
    if (r) setTimeout(() => setPartageMsg(null), 2500);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 44 }} showsVerticalScrollIndicator={false}>
      <Text style={[T.title, { fontFamily: F.extra, color: C.text }]}>Ton spectre</Text>
      <View style={{ backgroundColor: C.surfaceAlt, borderRadius: RADIUS.md, padding: 12, marginTop: 10, marginBottom: 18 }}>
        <Text style={[T.small, { color: C.textMuted }]}>
          Un spectre, pas un verdict. Calculé sur les seuls votes où tu t'es prononcé·e ({nbVotes}).
        </Text>
      </View>

      {/* Classement global — jamais un gagnant unique mis en avant. */}
      {resultat.global.map((g) => {
        const n = comparableTotal(g.abrev);
        const fiable = n >= 2;
        return (
          <View key={g.abrev} style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
            <HemicyclePicto groupes={partis} activeAbrev={g.abrev} color={couleur(g.abrev)} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{g.abrev}</Text>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: C.surfaceAlt, marginTop: 5, overflow: "hidden" }}>
                {fiable && <View style={{ height: 7, borderRadius: 4, width: `${Math.round(g.pct * 100)}%`, backgroundColor: couleur(g.abrev) }} />}
              </View>
              <Text style={[T.micro, { color: C.textFaint, marginTop: 3 }]}>{n} vote{n > 1 ? "s" : ""} comparé{n > 1 ? "s" : ""}</Text>
            </View>
            <Text style={[T.heading, tnum, { fontFamily: F.extra, color: fiable ? C.text : C.textFaint, minWidth: 52, textAlign: "right" }]}>
              {fiable ? `${Math.round(g.pct * 100)}%` : "—"}
            </Text>
          </View>
        );
      })}

      {/* Matrice thème × groupe : la pièce maîtresse (on n'est pas réductible à un parti). */}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 22, marginBottom: 4 }]}>Par thème</Text>
      <Text style={[T.small, { color: C.textMuted, marginBottom: 12 }]}>
        Ta proximité avec chaque groupe, thème par thème. Plus c'est foncé, plus tu es d'accord.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* En-têtes de colonnes */}
          <View style={{ flexDirection: "row", marginLeft: 92 }}>
            {colonnes.map((a) => (
              <Text key={a} style={[T.micro, { width: 30, textAlign: "center", color: C.textMuted, fontFamily: F.semibold }]} numberOfLines={1}>
                {a.replace("-NFP", "")}
              </Text>
            ))}
          </View>
          {themes.map((t) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <Text style={[T.micro, { width: 88, color: C.text, fontFamily: F.semibold }]} numberOfLines={2}>{libelle(t)}</Text>
              {colonnes.map((a) => {
                const cell = resultat.parTheme[t]?.[a];
                const pct = cell?.pct;
                return (
                  <View
                    key={a}
                    style={{
                      width: 28, height: 28, marginHorizontal: 1, borderRadius: 6,
                      backgroundColor: pct == null ? "transparent" : rgba(couleur(a), 0.12 + 0.88 * pct),
                      borderWidth: pct == null ? 1 : 0, borderColor: C.border,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Pondération par thème → recalcul du global en direct. */}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 24, marginBottom: 4 }]}>Ce qui compte pour toi</Text>
      <Text style={[T.small, { color: C.textMuted, marginBottom: 12 }]}>Donne plus ou moins de poids à un thème : le classement se recalcule.</Text>
      {themes.map((t) => (
        <View key={t} style={{ flexDirection: "row", alignItems: "center", marginBottom: 9, gap: 10 }}>
          <Text style={[T.small, { flex: 1, color: C.text, fontFamily: F.medium }]} numberOfLines={1}>{libelle(t)}</Text>
          <View style={{ flexDirection: "row", backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, padding: 3 }}>
            {NIVEAUX.map((n) => {
              const actif = (poids[t] ?? 1) === n.v;
              return (
                <TouchableOpacity key={n.label} onPress={() => setPoids((p) => ({ ...p, [t]: n.v }))} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}>
                  <Text style={[T.micro, { fontFamily: actif ? F.bold : F.medium, color: actif ? C.text : C.textMuted }]}>{n.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Partage (100 % client) + recommencer */}
      <TouchableOpacity onPress={onShare} activeOpacity={0.85} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9, marginTop: 22, backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingVertical: 14, ...shadowCard }}>
        <Feather name="share-2" size={18} color="#fff" />
        <Text style={[T.body, { fontFamily: F.bold, color: "#fff" }]}>{partageMsg ?? "Partager mon résultat"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => nav.push({ name: "testIntro" })} activeOpacity={0.7} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Recommencer</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
