import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, CONTROL, ICON, tnum } from "../theme";
import { Chip } from "./ui";
import { getScrutin } from "../api";
import { focusEditorial } from "../content/focus";
import { useFocusSemaine } from "../hooks/useHebdo";
import { useCibleTour } from "../tourTargets";
import { issueDe, libelleDate, libelleFenetre, objetDuScrutin, titreDepuisScrutin } from "../hebdo";
import { Barre, Carte, CeQueDitLeTexte, Chiffre, DejaVoteAN, Libelle, Parcours, VentilationGroupes } from "./FocusSenat";
import type { DetailScrutin } from "../types";
import type { Nav } from "../nav";

/** Règle affichée en pied de bloc : la même que celle appliquée (focusSemaine.ts). */
export const REGLE_FOCUS = "Choisi automatiquement : le plus de votants de la semaine.";

/**
 * FOCUS DE LA SEMAINE (accueil). Le scrutin n'est pas choisi à la main : c'est celui de l'édition
 * « La semaine à l'Assemblée » qui a réuni le plus de votants (focusSemaine.ts), et la règle est
 * écrite en pied de bloc. Tout est construit à partir des données, par gabarits : titre court du
 * texte (celui de l'édition), objet du vote lu dans l'intitulé, résultat, ventilation par groupe.
 * Contenu éditorial (`focusEditorial`, content/focus.ts) affiché EN PLUS quand il existe pour ce
 * scrutin ; il n'influe jamais sur le choix. Semaine sans scrutin public : le focus de la
 * dernière édition qui en a eu, en le disant. Rien pendant le chargement.
 */
export function FocusSemaineBloc({ nav }: { nav: Nav }) {
  const f = useFocusSemaine();
  // Cible de la visite guidée (le bloc entier), enregistrée seulement quand le focus s'affiche.
  const refTour = useCibleTour("actualite");
  const uid = f?.focus.scrutin.uid ?? null;
  const edito = uid ? focusEditorial[uid] : undefined;
  const idLie = edito?.scrutinANLie?.scrutinId ?? null;
  // Détail du scrutin (ventilation par groupe) : undefined = en cours, null = indisponible.
  const [detail, setDetail] = useState<DetailScrutin | null | undefined>(undefined);
  const [lie, setLie] = useState<DetailScrutin | null>(null);

  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    setDetail(undefined);
    getScrutin(uid).then((d) => vivant && setDetail(d)).catch(() => vivant && setDetail(null));
    return () => {
      vivant = false;
    };
  }, [uid]);
  useEffect(() => {
    if (!idLie) return;
    let vivant = true;
    getScrutin(idLie).then((d) => vivant && setLie(d)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [idLie]);

  if (!f) return null;
  const { focus, texte, annee } = f;
  const s = focus.scrutin;
  const titre = texte?.titre ?? titreDepuisScrutin(s.titre);
  const issue = issueDe(s.sort_code);
  // « cette semaine », ou la fenêtre de l'édition d'où vient le focus quand la semaine est vide.
  const fen = libelleFenetre(focus.vendrediSource, annee);
  const quand = focus.repli ? fen.charAt(0).toLowerCase() + fen.slice(1) : "cette semaine";
  const ouvrir = () => nav.push({ name: "scrutin", uid: s.uid });

  return (
    <View ref={refTour} collapsable={false} style={{ marginTop: 22 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>Focus de la semaine</Text>
        {focus.repli && <Text style={[T.micro, { color: C.textMuted, marginTop: 4 }]}>Pas de scrutin public cette semaine.</Text>}
        <Text style={[T.title, { color: C.text, letterSpacing: -0.5, marginTop: 10 }]} accessibilityRole="header">
          {titre}
        </Text>
        <Text style={[T.small, tnum, { color: C.textMuted, marginTop: 5, lineHeight: 18 }]}>
          Le scrutin qui a réuni le plus de votants {quand}
          {s.date ? ` · ${libelleDate(s.date).replace(/ /g, " ")}` : ""}
        </Text>
      </View>

      {!!edito?.points?.length && <CeQueDitLeTexte points={edito.points} />}

      <Carte>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <Text style={[T.body, { flex: 1, fontFamily: F.extra, color: C.text }]}>{objetDuScrutin(s)}</Text>
          {issue && (
            <Chip
              label={issue === "adopte" ? "Adopté" : "Rejeté"}
              bg={issue === "adopte" ? C.adopteBg : C.rejeteBg}
              fg={issue === "adopte" ? C.adopteFg : C.rejeteFg}
              ph={8}
            />
          )}
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 18, marginTop: 10, marginBottom: 9 }}>
          <Chiffre n={s.pour ?? 0} label="pour" couleur={C.pour} grand />
          <Chiffre n={s.contre ?? 0} label="contre" couleur={C.contre} grand />
          <Chiffre n={s.abstention ?? 0} label="abstention" couleur={C.abstention} grand />
          <Text style={[T.micro, tnum, { marginLeft: "auto", color: C.textMuted }]}>{focus.votants} votants</Text>
        </View>
        <Barre pour={s.pour ?? 0} contre={s.contre ?? 0} abstention={s.abstention ?? 0} hauteur={8} />
      </Carte>

      <Carte>
        <Libelle>Les groupes</Libelle>
        {detail === undefined ? (
          <ActivityIndicator color={C.textMuted} style={{ marginVertical: 14 }} />
        ) : detail ? (
          <VentilationGroupes groupes={detail.groupes} />
        ) : (
          <Text style={[T.small, { color: C.textMuted, marginTop: 8 }]}>Détail par groupe indisponible pour le moment.</Text>
        )}
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={ouvrir}
          accessibilityRole="button"
          accessibilityLabel={`Voir le scrutin : ${objetDuScrutin(s)}, ${titre}`}
          style={{ alignSelf: "flex-start", minHeight: CONTROL.md, justifyContent: "center" }}
        >
          <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>Voir le scrutin</Text>
        </TouchableOpacity>
      </Carte>

      {edito?.scrutinANLie && lie && (
        <DejaVoteAN lie={edito.scrutinANLie} detail={lie} onOuvrir={() => nav.push({ name: "scrutin", uid: lie.scrutin.uid })} />
      )}
      {!!edito?.parcours?.length && <Parcours etapes={edito.parcours} procedure={edito.procedure} />}

      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 16, marginTop: 10 }}>
        <Feather name="info" size={ICON.xs} color={C.textFaint} style={{ marginTop: 1 }} />
        <Text style={[T.micro, { flex: 1, color: C.textFaint }]}>{REGLE_FOCUS}</Text>
      </View>
    </View>
  );
}
