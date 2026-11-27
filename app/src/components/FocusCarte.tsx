import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, type ViewStyle } from "react-native";
import { C, F, T, RADIUS, CONTROL, tnum } from "../theme";
import { Chip } from "./ui";
import { getScrutin } from "../api";
import { useCibleTour } from "../tourTargets";
import { issueDe, objetDuScrutin, titreDepuisScrutin } from "../hebdo";
import { Barre } from "./FocusSenat";
import { PastilleVote } from "./PastilleVote";
import { useJe } from "../testProximite/jeProximite";
import { estSitue } from "../testProximite/storage";
import { groupesPos } from "../testProximite/verdict";
import type { FocusSemaineAccueil } from "../hooks/useHebdo";
import type { DetailScrutin } from "../types";
import type { Nav } from "../nav";

/** Règle du choix, dite sur la carte : la même que celle appliquée (focusSemaine.ts). */
export const REGLE_FOCUS_COURTE = "le plus de la semaine";

function Decompte({ n, label, couleur }: { n: number; label: string; couleur: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: couleur }} />
      <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.text }]}>
        {n} {label}
      </Text>
    </View>
  );
}

/**
 * LE VOTE LE PLUS SUIVI : première carte du carrousel « La semaine à l'Assemblée » (accueil allégé,
 * maquette validée le 14/11/2026). C'est le focus de la semaine en version courte : le scrutin
 * de l'édition qui a réuni le plus de votants (focusSemaine.ts), son résultat, et la pastille
 * « comme toi » (gardée même si la maquette ne la montrait pas : c'est le prisme de l'appli).
 * Le vote de chaque groupe est sur la fiche du scrutin. Contenu éditorial (`focusEditorial`) :
 * réservé au bloc complet `FocusSemaineBloc`, qui n'est plus affiché sur l'accueil.
 */
export function FocusCarte({ f, width, nav, onHauteur, style }: { f: FocusSemaineAccueil; width: number; nav: Nav; onHauteur: (h: number) => void; style?: ViewStyle }) {
  // Cible de la visite guidée : la carte entière.
  const refTour = useCibleTour("actualite");
  const s = f.focus.scrutin;
  const titre = f.texte?.titre ?? titreDepuisScrutin(s.titre);
  const issue = issueDe(s.sort_code);
  const objet = objetDuScrutin(s);
  const ouvrir = () => nav.push({ name: "scrutin", uid: s.uid });
  // Positions des groupes : seulement pour la pastille « comme toi » (undefined = en cours).
  const [detail, setDetail] = useState<DetailScrutin | null | undefined>(undefined);
  const je = useJe();
  const [situe] = useState(estSitue);
  useEffect(() => {
    let vivant = true;
    setDetail(undefined);
    getScrutin(s.uid).then((d) => vivant && setDetail(d)).catch(() => vivant && setDetail(null));
    return () => {
      vivant = false;
    };
  }, [s.uid]);

  return (
    <View
      ref={refTour}
      collapsable={false}
      onLayout={(ev) => onHauteur(ev.nativeEvent.layout.height)}
      style={[{ width, alignSelf: "flex-start", backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }, style]}
    >
      <TouchableOpacity activeOpacity={0.6} onPress={ouvrir} accessibilityRole="button" accessibilityLabel={`Le vote le plus suivi : ${objet}, ${titre}. Voir le scrutin`}>
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }]}>Le vote le plus suivi</Text>
        <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 6 }]} numberOfLines={3}>
          {titre}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
          <Text style={[T.small, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={2}>
            {objet}
          </Text>
          {issue && (
            <Chip
              label={issue === "adopte" ? "Adopté" : "Rejeté"}
              bg={issue === "adopte" ? C.adopteBg : C.rejeteBg}
              fg={issue === "adopte" ? C.adopteFg : C.rejeteFg}
              ph={8}
            />
          )}
        </View>
        <View style={{ marginTop: 10 }}>
          <Barre pour={s.pour ?? 0} contre={s.contre ?? 0} abstention={s.abstention ?? 0} hauteur={8} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4, marginTop: 8 }}>
          <Decompte n={s.pour ?? 0} label="pour" couleur={C.pour} />
          <Decompte n={s.contre ?? 0} label="contre" couleur={C.contre} />
          <Decompte n={s.abstention ?? 0} label="abst." couleur={C.abstention} />
        </View>
        <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 8 }]}>
          {f.focus.votants} votants, {REGLE_FOCUS_COURTE}.
        </Text>
      </TouchableOpacity>
      {/* Pastille « comme toi » (touchée : tiroir de vote, jamais la page) puis « Voir le scrutin ». */}
      <PastilleVote
        uid={s.uid}
        numero={s.numero ?? null}
        sortCode={s.sort_code}
        groupes={detail ? groupesPos(detail.groupes) : []}
        ctx={je}
        situe={situe}
        ligne="carte"
        onVerrouille={() => nav.push({ name: "testIntro" })}
        style={{ marginTop: 4 }}
        aCote={
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={ouvrir}
            accessibilityRole="button"
            accessibilityLabel={`Voir le scrutin : ${objet}, ${titre}`}
            style={{ marginLeft: "auto", minHeight: CONTROL.md, justifyContent: "center" }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin</Text>
          </TouchableOpacity>
        }
      />
    </View>
  );
}
