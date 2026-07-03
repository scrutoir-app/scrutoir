import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, shadowCard, S } from "../theme";
import { getTestProximite, getPartis, getCategories } from "../api";
import { Button } from "../components/ui";
import type { PartiResume, CategorieRef } from "../types";
import type { Nav } from "../nav";
import type { QuestionProximite, Reponse } from "../testProximite/score";
import { phraseAlignement } from "../testProximite/phrase";
import { chargerTest, fusionnerReponses } from "../testProximite/storage";
import { questionsNeuves, N_AFFINER } from "../testProximite/config";
import { VoteBarDivergenteCentree } from "../components/VoteBarDivergenteCentree";
import { track } from "../analytics";

const N_COMPLET = 12;
const N_THEME = 10;

function melange<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tirage : mode thème = jusqu'à 10 du thème ; mode complet = ~12 réparties sur les
 *  thèmes ET les familles de clivage (round-robin + variation de l'axe), sans doublon. */
function tirer(all: QuestionProximite[], mode: "theme" | "complet", theme?: string): QuestionProximite[] {
  if (mode === "theme") return melange(all.filter((q) => q.theme === theme)).slice(0, N_THEME);

  const byTheme: Record<string, QuestionProximite[]> = {};
  for (const q of all) (byTheme[q.theme] ||= []).push(q);
  Object.values(byTheme).forEach((l) => l.sort(() => Math.random() - 0.5));
  const themes = melange(Object.keys(byTheme));
  const picked: QuestionProximite[] = [];
  const seenFam = new Set<string>();
  while (picked.length < N_COMPLET && themes.some((t) => byTheme[t].length)) {
    for (const t of themes) {
      if (picked.length >= N_COMPLET) break;
      const pool = byTheme[t];
      if (!pool.length) continue;
      let i = pool.findIndex((q) => !seenFam.has(q.famille_clivage ?? ""));
      if (i < 0) i = 0;
      const [q] = pool.splice(i, 1);
      picked.push(q);
      seenFam.add(q.famille_clivage ?? "");
    }
  }
  return picked;
}

export function TestScreen({ mode, theme, nav }: { mode: "theme" | "complet" | "affiner"; theme?: string; themeLibelle?: string; nav: Nav }) {
  const [all, setAll] = useState<QuestionProximite[] | null>(null);
  // Test déjà fait (pour le mode « affiner » : on sert les votes NON répondus et on
  // fusionne les réponses à l'arrivée — chaque session approfondit le même « je »).
  const dejaFait = useMemo(() => (mode === "affiner" ? chargerTest() : null), [mode]);
  const [partis, setPartis] = useState<PartiResume[]>([]);
  const [cats, setCats] = useState<CategorieRef[]>([]);
  const [idx, setIdx] = useState(0);
  const [reponses, setReponses] = useState<Record<number, Reponse>>({});
  const [revealed, setRevealed] = useState(false);

  // Engagement anonyme : « un test a commencé/terminé » + le thème (ou « complet »).
  // JAMAIS les réponses ni le parti compatible (opinion politique = RGPD art. 9).
  const testKey = mode === "affiner" ? "affiner" : mode === "theme" ? theme ?? "theme" : "complet";
  useEffect(() => {
    track("test_start", testKey);
  }, []);

  useEffect(() => {
    Promise.all([getTestProximite(), getPartis(), getCategories()]).then(([qs, ps, cs]) => {
      setPartis(ps);
      setCats(cs);
      setAll(qs);
    });
  }, []);

  // Tirage figé une fois les questions chargées (ne pas re-tirer à chaque rendu).
  const questions = useMemo(() => {
    if (!all) return [];
    if (mode === "affiner") return questionsNeuves(all, dejaFait?.reponses ?? {}, dejaFait?.poids, theme).slice(0, N_AFFINER);
    return tirer(all, mode, theme);
  }, [all, mode, theme, dejaFait]);
  const seats = useMemo(() => Object.fromEntries(partis.map((p) => [p.abrev, p.nb_deputes])), [partis]);
  const libelleTheme = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;

  if (!all) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={C.textMuted} /></View>;
  if (!questions.length)
    return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text style={{ textAlign: "center", color: C.textMuted }}>Aucune question disponible pour ce thème.</Text></View>;

  const q = questions[idx];
  const total = questions.length;
  const rep = reponses[q.id];

  const repondre = (r: Reponse) => { setReponses((p) => ({ ...p, [q.id]: r })); setRevealed(true); };
  const suivant = () => {
    if (idx + 1 >= total) {
      track("test_done", testKey);
      // Les réponses s'ACCUMULENT (tous modes), les poids ne sont PAS touchés. Le résultat
      // « mes résultats » relit réponses + poids depuis le stockage (rien passé en param).
      fusionnerReponses({ ...reponses, [q.id]: rep! });
      nav.push({ name: "testResultat" });
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Progression */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ backgroundColor: C.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 5 }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: C.accent }]}>{libelleTheme(q.theme)}</Text>
        </View>
        <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted }]}>{idx + 1} / {total}</Text>
      </View>
      <View style={{ height: 5, borderRadius: 3, backgroundColor: C.surfaceAlt, marginBottom: 22, overflow: "hidden" }}>
        <View style={{ height: 5, borderRadius: 3, backgroundColor: C.accent, width: `${((idx + (revealed ? 1 : 0)) / total) * 100}%` }} />
      </View>

      {/* Thèse */}
      <Text style={[T.title, { fontFamily: F.extra, color: C.text, lineHeight: 30 }]}>{q.these}</Text>

      {!revealed ? (
        <View style={{ marginTop: 26, gap: 11 }}>
          <ChoixBouton label="Pour" couleur={C.pour} onPress={() => repondre("pour")} />
          <ChoixBouton label="Sans avis" couleur={C.textFaint} onPress={() => repondre("sans_avis")} />
          <ChoixBouton label="Contre" couleur={C.contre} onPress={() => repondre("contre")} />
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
            <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.3 }]}>
              Comment l'Assemblée a voté
            </Text>
            <VoteBarDivergenteCentree pour={q.totaux!.pour} contre={q.totaux!.contre} abstention={q.totaux!.abstention} decompte />
            <Text style={[T.body, { color: C.text, marginTop: 16 }]}>{phraseAlignement(q.positions, rep!, seats)}</Text>
            {q.source_url && (
              <TouchableOpacity onPress={() => Linking.openURL(q.source_url!)} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }} hitSlop={6}>
                <Feather name="external-link" size={13} color={C.accent} />
                <Text style={[T.small, { fontFamily: F.semibold, color: C.accent }]}>Voir le scrutin sur le site de l'Assemblée</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            label={idx + 1 >= total ? "Voir mon résultat" : "Question suivante"}
            onPress={suivant}
            fullWidth
            style={{ marginTop: S.s18 }}
          />
        </View>
      )}
    </ScrollView>
  );
}

function ChoixBouton({ label, couleur, onPress }: { label: string; couleur: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: C.border, ...shadowCard }}
    >
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: couleur }} />
      <Text style={[T.body, { fontFamily: F.bold, color: C.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}
