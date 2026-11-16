import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Platform, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { C, F, T, S, CONTROL } from "../theme";
import { getScrutin, getTestProximite } from "../api";
import { useEtatTest } from "../testProximite/useReponses";
import { origineDe, type Origine } from "../testProximite/storage";
import { verdictScrutin, type GroupePos } from "../testProximite/verdict";
import { statutPerso, type StatutPerso } from "../testProximite/questionsPerso";
import { ligneVote, reponseCompte } from "../testProximite/texteVote";
import type { ContexteJe } from "../testProximite/jeProximite";
import type { Reponse } from "../testProximite/score";
import { VerdictPastille } from "./VerdictPastille";
import { useTiroirVote } from "./TiroirVote";
import { useReduceMotion } from "./HeroScrutins";
import { ANCRE_VOTES_HORS_TEST } from "../content/infos";

/**
 * La pastille « comme toi » d'un scrutin, partout dans l'appli (fiche, cartes du Fil et de la
 * Liste, texte, Focus de la semaine). Elle lit ta réponse en direct : la corriger dans le tiroir
 * met à jour la pastille sur place. Déduit, voté ou sans avis : un tap ouvre le tiroir de vote.
 * Verrouillé (pas situé) : `onVerrouille` (légende, onboarding ou test, selon l'écran).
 *
 * Ligne sous la pastille : toujours sur la fiche du scrutin (`ligne="page"`) ; sur une carte,
 * seulement après une réponse posée depuis le tiroir pendant la session (fondu de 260 ms).
 */
export function PastilleVote({
  uid,
  numero,
  sortCode,
  groupes,
  ctx,
  situe,
  onVerrouille,
  ligne = "carte",
  invite = false,
  aCote,
  style,
}: {
  uid: string;
  numero: number | null;
  sortCode: string | null | undefined;
  groupes: GroupePos[];
  ctx: ContexteJe | null;
  situe: boolean;
  onVerrouille: () => void;
  ligne?: "page" | "carte";
  invite?: boolean;
  /** Posé sur la même rangée que la pastille (ex. « Voir le scrutin ») ; la ligne passe dessous. */
  aCote?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const etat = useEtatTest();
  const tiroir = useTiroirVote();
  const reponse: Reponse | undefined = numero != null ? etat?.reponses[numero] : undefined;
  const verdict = verdictScrutin({ ctx, situe, reponse, groupes, sortCode });
  const verrou = verdict.niveau === "verrouille";
  const montrerLigne =
    !verrou && numero != null && (ligne === "page" || (reponse !== undefined && tiroir.repondusSession.has(numero)));

  const pastille = <VerdictPastille verdict={verdict} onPress={verrou ? onVerrouille : () => tiroir.ouvrir(uid)} invite={invite} />;
  return (
    <View style={style}>
      {aCote ? (
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: S.s10 }}>
          {pastille}
          {aCote}
        </View>
      ) : (
        pastille
      )}
      {montrerLigne && <LigneVote uid={uid} numero={numero!} reponse={reponse} origine={origineDe(etat, numero!)} />}
    </View>
  );
}

const natif = Platform.OS !== "web";
const tranche = (r: unknown): r is "pour" | "contre" => r === "pour" || r === "contre";

/** Le scrutin est-il une question actuelle du test, et compterait-il hors test ? (fichiers en cache) */
function useStatutVote(uid: string, numero: number): { dansTest: boolean; statut: StatutPerso } | null {
  const [st, setSt] = useState<{ dansTest: boolean; statut: StatutPerso } | null>(null);
  useEffect(() => {
    let vivant = true;
    Promise.all([getScrutin(uid), getTestProximite()])
      .then(([d, qs]) => {
        if (!vivant) return;
        const s = d.scrutin;
        setSt({
          dansTest: qs.some((q) => q.id === numero),
          statut: statutPerso({ titre: s.titre, type_vote: s.type_vote, dossier_titre: s.dossier_titre, groupes: d.groupes }),
        });
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, [uid, numero]);
  return st;
}

function LigneVote({ uid, numero, reponse, origine }: { uid: string; numero: number; reponse: Reponse | undefined; origine: Origine }) {
  const tiroir = useTiroirVote();
  const reduce = useReduceMotion();
  const st = useStatutVote(uid, numero);
  const compte = reponseCompte({ reponse, dansTest: !!st?.dansTest, origine, statut: st?.statut ?? null });
  const texte = tranche(reponse) && !st ? null : ligneVote({ reponse, compte });
  // « Pourquoi ce scrutin ne compte pas » : budget, motion ou vote quasi unanime tranché hors test.
  const pourquoi = tranche(reponse) && !!st && !st.dansTest && origine === "scrutin" && st.statut !== "compte";

  // Fondu-montée de 260 ms à chaque nouveau texte (coupé si animations réduites).
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (!texte) return;
    if (reduce) { v.setValue(1); return; }
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: natif }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texte, reduce]);

  if (!texte) return null;
  return (
    <Animated.View style={{ marginTop: S.s6, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
      <Text style={[T.small, { color: C.textMuted, lineHeight: 18 }]} accessibilityLiveRegion="polite">{texte}</Text>
      {pourquoi && (
        <TouchableOpacity
          onPress={() => tiroir.nav?.push({ name: "apropos", ancre: ANCRE_VOTES_HORS_TEST })}
          accessibilityRole="link"
          style={{ alignSelf: "flex-start", minHeight: CONTROL.md, justifyContent: "center" }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent, textDecorationLine: "underline" }]}>Pourquoi ce scrutin ne compte pas</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
