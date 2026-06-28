import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { calculerProximite } from "../testProximite/score";
import { HemicyclePicto } from "../components/HemicyclePicto";
import { ScrutoirMark } from "../components/ScrutoirMark";
import { useFollow } from "../follows";
import { chargerTest, chargerPoids, sauverPoids, effacerTest, urlPartage } from "../testProximite/storage";

const NIVEAUX = [
  { label: "Peu", v: 0.5 },
  { label: "Normal", v: 1 },
  { label: "Fort", v: 2 },
];

// Nom court d'un groupe (1ʳᵉ partie avant « & » / « , ») pour le CTA « Suivre … ».
const nomCourt = (libelle: string) => libelle.split(/\s*[&,]\s*/)[0];

// Bloc « Et maintenant, explore » : 4 portes de sortie vers les autres lectures.
const EXPLORE: { label: string; icon?: string; picto?: boolean; route: { name: string } }[] = [
  { label: "Par thème", icon: "grid", route: { name: "testParTheme" } },
  { label: "Par scrutin", icon: "file-text", route: { name: "themes" } },
  { label: "Par parti", picto: true, route: { name: "partis" } },
  { label: "Par député", icon: "user", route: { name: "monDepute" } },
];

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
  reponses: reponsesProp,
  poids: poidsProp,
  partage = false,
  nav,
}: {
  reponses?: Record<number, Reponse>;
  themesJoues?: string[];
  poids?: Record<string, number>;
  partage?: boolean;
  nav: Nav;
}) {
  const [all, setAll] = useState<QuestionProximite[] | null>(null);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [partageMsg, setPartageMsg] = useState<string | null>(null);

  // Source des réponses : lien PARTAGÉ → la prop (lecture seule) ; sinon → MES réponses
  // accumulées dans le stockage local. Figées au montage (le résultat ne se réécrit pas seul).
  const reponses = useMemo(() => (partage ? reponsesProp ?? {} : chargerTest()?.reponses ?? {}), [partage, reponsesProp]);
  // Poids : partagé → ceux du lien ; sinon → MES poids persistés (jamais remis à zéro ici).
  const [poids, setPoids] = useState<Record<string, number>>(() => (partage ? { ...(poidsProp ?? {}) } : { ...chargerPoids() }));

  useEffect(() => {
    Promise.all([getTestProximite(), getPartis(), getCategories()]).then(([qs, ps, cs]) => {
      setAll(qs); setPartis(ps); setCats(cs);
    });
  }, []);

  // Questions réellement répondues + thèmes joués (dérivés → vaut pour un lien partagé aussi).
  const jouees = useMemo(() => (all ? all.filter((q) => reponses[q.id] != null) : []), [all, reponses]);
  const themes = useMemo(() => [...new Set(jouees.map((q) => q.theme))].sort(), [jouees]);

  // Complète les poids des thèmes pas encore réglés (défaut « Normal » = 1) SANS jamais
  // toucher aux thèmes déjà pondérés. Un passage de test ne réinitialise donc rien.
  useEffect(() => {
    if (!themes.length) return;
    setPoids((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const t of themes) if (next[t] == null) { next[t] = (partage ? poidsProp?.[t] : undefined) ?? 1; changed = true; }
      return changed ? next : prev;
    });
  }, [themes.join("|")]);

  // Changer un poids = choix utilisateur : on le persiste seul (hors mode partagé).
  const changerPoids = (theme: string, v: number) => {
    setPoids((prev) => {
      const next = { ...prev, [theme]: v };
      if (!partage) sauverPoids(next);
      return next;
    });
  };

  // « Repartir de zéro » : SEUL geste qui efface réponses + poids (jamais en sortie de test).
  const repartirDeZero = () => { effacerTest(); nav.push({ name: "testIntro" }); };

  const groupes = useMemo(() => partis.filter((p) => p.abrev).map((p) => ({ abrev: p.abrev! })), [partis]);
  const resultat = useMemo(
    () => (jouees.length && groupes.length ? calculerProximite(jouees, reponses, poids, groupes) : null),
    [jouees, reponses, poids, groupes]
  );

  // Groupe le plus proche (FIABLE : ≥ 2 votes comparés) — cible du CTA « Suivre ».
  const topAbrev = useMemo(() => {
    if (!resultat) return null;
    const comparable = (abrev: string) =>
      Object.values(resultat.parTheme).reduce((s, t) => s + (t[abrev]?.comparable ?? 0), 0);
    const fiables = resultat.global.filter((g) => comparable(g.abrev) >= 2);
    return (fiables[0] ?? resultat.global[0])?.abrev ?? null;
  }, [resultat]);
  const topParti = topAbrev ? partis.find((p) => p.abrev === topAbrev) : null;
  const [suiviTop, toggleSuiviTop] = useFollow(topParti?.uid ?? "");

  if (!resultat) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;

  const couleur = (abrev: string) => partis.find((p) => p.abrev === abrev)?.couleur ?? C.textFaint;
  const libelle = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  const comparableTotal = (abrev: string) =>
    themes.reduce((s, t) => s + (resultat.parTheme[t]?.[abrev]?.comparable ?? 0), 0);
  const nbVotes = Object.values(reponses).filter((r) => r === "pour" || r === "contre").length;

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
      <Text style={[T.title, { fontFamily: F.extra, color: C.text }]}>Ton point de départ</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 6, marginBottom: 16 }]}>
        De qui tu es proche, selon ce qu'ils ont voté. Un spectre, pas un verdict — calculé sur les {nbVotes} votes où tu t'es prononcé·e.
      </Text>

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
                {fiable && <View style={{ height: 7, borderRadius: 4, width: `${Math.round(g.pct * 100)}%`, backgroundColor: couleurGroupe(couleur(g.abrev)) }} />}
              </View>
              <Text style={[T.micro, { color: C.textFaint, marginTop: 3 }]}>{n} vote{n > 1 ? "s" : ""} comparé{n > 1 ? "s" : ""}</Text>
            </View>
            <Text style={[T.heading, tnum, { fontFamily: F.extra, color: fiable ? C.text : C.textFaint, minWidth: 52, textAlign: "right" }]}>
              {fiable ? `${Math.round(g.pct * 100)}%` : "—"}
            </Text>
          </View>
        );
      })}

      {/* CTA : suivre le groupe le plus proche (cloche = suivi, comme partout dans l'app). */}
      {topParti && (
        <TouchableOpacity
          onPress={toggleSuiviTop}
          activeOpacity={0.85}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 18, paddingVertical: 15, borderRadius: RADIUS.pill, backgroundColor: suiviTop ? C.surfaceAlt : C.accent, borderWidth: suiviTop ? 1 : 0, borderColor: C.borderStrong, ...shadowCard }}
        >
          <Feather name={suiviTop ? "check" : "bell"} size={18} color={suiviTop ? C.text : "#fff"} />
          <Text style={[T.body, { fontFamily: F.bold, color: suiviTop ? C.text : "#fff" }]}>
            {suiviTop ? `Tu suis ${nomCourt(topParti.libelle)}` : `Suivre ${nomCourt(topParti.libelle)}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Bloc explore : prolonge le « je » vers les autres lectures. */}
      <Text style={[T.callout, { fontFamily: F.extra, color: C.text, marginTop: 26, marginBottom: 12 }]}>Et maintenant, explore</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {EXPLORE.map((e) => (
          <TouchableOpacity
            key={e.label}
            activeOpacity={0.8}
            onPress={() => nav.push(e.route as any)}
            style={{ width: "47.8%", flexGrow: 1, alignItems: "center", gap: 8, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 18, borderWidth: 1, borderColor: C.border, ...shadowCard }}
          >
            {e.picto ? (
              <ScrutoirMark size={26} color={C.text} accent={C.accent} />
            ) : (
              <Feather name={e.icon as any} size={22} color={C.accent} />
            )}
            <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
                <TouchableOpacity key={n.label} onPress={() => changerPoids(t, n.v)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, backgroundColor: actif ? C.surface : "transparent", ...(actif ? shadowCard : {}) }}>
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
      <TouchableOpacity onPress={repartirDeZero} activeOpacity={0.7} style={{ alignItems: "center", marginTop: 14 }}>
        <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Repartir de zéro</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
