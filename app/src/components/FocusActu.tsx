import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, CONTROL, ICON, tnum } from "../theme";
import { catUI } from "../categoryUI";
import { FOCUS } from "../content/focus";
import { useFocusActu } from "../hooks/useHebdo";
import { useCibleTour } from "../tourTargets";
import { VoteBarDivergenteCentree } from "./VoteBarDivergenteCentree";
import { libelleDate, metaFocus, type TexteHebdo, type VoteEnsemble } from "../hebdo";
import type { Nav } from "../nav";

const VISIBLES = 3;

/**
 * Focus actualité de l'accueil : un sujet choisi (content/focus.ts) et la frise des textes
 * votés en scrutin public qui y répondent, du plus récent au plus ancien. Le critère de
 * sélection est affiché. Rien hors période, pendant le chargement, ou sans texte retenu.
 */
export function FocusActu({ nav }: { nav: Nav }) {
  const textes = useFocusActu(FOCUS);
  const [ouvert, setOuvert] = useState(false);
  // Cible de la visite guidée (la carte entière), enregistrée seulement quand le focus s'affiche.
  const refTour = useCibleTour("actualite");
  if (!FOCUS || !textes || textes.length === 0) return null;

  const pastille = FOCUS.categorie ? catUI(FOCUS.categorie).fg : C.accent;
  // Vote final mis en avant : celui du premier texte de la frise (le plus récent) qui a eu un
  // vote sur l'ensemble en scrutin public. Choix mécanique, comme celui des textes.
  const principal = textes.find((t) => t.voteEnsemble);
  const vote = principal?.voteEnsemble ?? null;
  const liste = ouvert ? textes : textes.slice(0, VISIBLES);
  const reste = textes.length - VISIBLES;
  const ouvrir = (t: TexteHebdo) =>
    t.dossierRef ? nav.push({ name: "dossierScrutins", ref: t.dossierRef, titre: t.titre }) : nav.push({ name: "scrutin", uid: t.scrutinUid });

  return (
    <View ref={refTour} collapsable={false} style={{ marginHorizontal: 16, marginTop: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pastille }} />
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>Focus actualité</Text>
      </View>
      <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>{FOCUS.titre}</Text>
      {principal && vote && <VoteFinal texte={principal} vote={vote} onOuvrir={() => nav.push({ name: "scrutin", uid: vote.uid })} />}
      <Text style={[T.small, { color: C.textMuted, marginTop: vote ? 2 : 6 }]}>{FOCUS.contexte}</Text>

      <View style={{ marginTop: 14 }}>
        {liste.map((t, i) => (
          <View key={t.cle} style={{ flexDirection: "row", gap: 12 }}>
            {/* Frise : un point par texte, relié au suivant. */}
            <View style={{ width: 10, alignItems: "center" }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: pastille }} />
              {i < liste.length - 1 && <View style={{ flex: 1, width: 1.5, marginTop: 4, backgroundColor: C.borderStrong }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 16 }}>
              <TouchableOpacity activeOpacity={0.6} onPress={() => ouvrir(t)} accessibilityRole="button">
                <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{libelleDate(t.derniereDate)}</Text>
                <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 3 }]}>{t.titre}</Text>
                <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 4 }]}>{metaFocus(t)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {reste > 0 && (
        <TouchableOpacity
          onPress={() => setOuvert((o) => !o)}
          accessibilityRole="button"
          aria-expanded={ouvert}
          style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 22, minHeight: CONTROL.md, marginTop: -6 }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>
            {ouvert ? "Réduire" : reste === 1 ? "Voir l'autre texte" : `Voir les ${reste} autres textes`}
          </Text>
          <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={ICON.sm} color={C.accent} />
        </TouchableOpacity>
      )}

      <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, paddingBottom: 12 }}>
        {FOCUS.aSuivre && (
          <>
            <Text style={[T.small, { fontFamily: F.bold, color: C.text }]}>À suivre</Text>
            <Text style={[T.small, { color: C.textMuted, marginTop: 3 }]}>{FOCUS.aSuivre}</Text>
          </>
        )}
        <Text style={[T.small, { color: C.textFaint, marginTop: FOCUS.aSuivre ? 10 : 0 }]}>{FOCUS.critere}</Text>
      </View>
    </View>
  );
}

/**
 * Vote final mis en avant en tête du focus : issue (et lecture), vote solennel ou non, puis la
 * barre et les décomptes de la fiche scrutin, et l'accès direct à cette fiche. À plat dans la
 * carte du focus (pas de carte imbriquée), le lien en texte : le bloc sombre du test reste la
 * seule action forte de l'accueil.
 */
function VoteFinal({ texte, vote, onOuvrir }: { texte: TexteHebdo; vote: VoteEnsemble; onOuvrir: () => void }) {
  const adopte = texte.ensemble === "adopte";
  const fg = adopte ? C.adopteFg : C.rejeteFg;
  const masculin = texte.genre.startsWith("projet") || texte.genre === "autre"; // « le projet de loi », « le scrutin »
  const issue = `${adopte ? "Adopté" : "Rejeté"}${masculin ? "" : "e"}${texte.lectureEnsemble ? ` · ${texte.lectureEnsemble}` : ""}`;
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: adopte ? C.adopteBg : C.rejeteBg }}>
          <Text style={[T.micro, { fontFamily: F.bold, color: fg }]}>{issue}</Text>
        </View>
        {vote.date ? (
          <Text style={[T.micro, tnum, { color: C.textMuted }]}>
            {vote.solennel ? "Vote solennel" : "Scrutin public"} · {libelleDate(vote.date)}
          </Text>
        ) : null}
      </View>
      <View style={{ marginTop: 10 }}>
        <VoteBarDivergenteCentree pour={vote.pour} contre={vote.contre} abstention={vote.abstention} decompte />
      </View>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={onOuvrir}
        accessibilityRole="button"
        accessibilityLabel={`Voir le scrutin du vote sur l'ensemble : ${texte.titre}`}
        style={{ alignSelf: "flex-start", minHeight: CONTROL.md, justifyContent: "center" }}
      >
        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin</Text>
      </TouchableOpacity>
    </View>
  );
}
