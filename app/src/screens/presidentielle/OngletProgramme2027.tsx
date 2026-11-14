// Fiche parti, sous-onglet « Programme 2027 » (deuxième porte vers l'écran programme). Rendu
// seulement si le programme du parti est en service (cf. PartiScreen).
import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { Nav } from "../../nav";
import type { Perimetre, ProgrammeResume } from "../../presidentielle/types";
import { getProgramme } from "../../presidentielle/donnees";
import { dateLongue, ligneComptes, nombre, pluriel } from "../../presidentielle/libelles";
import { useData } from "../../hooks/useData";
import { ErreurChargement } from "../../components/ErreurChargement";
import { Kicker, LigneComptes, Pression } from "../../components/presidentielle/primitives";
import { AnneauxSelections, echelleSelection } from "./ProgrammeScreen";
import { Chargement } from "./commun";

const SELECTIONS: { id: Perimetre; nom: string }[] = [
  { id: "all", nom: "Tout le programme" },
  { id: "cle", nom: "Mesures clés" },
  { id: "ch", nom: "Chiffrées par le parti" },
];

export function OngletProgramme2027({ resume, nav }: { resume: ProgrammeResume; nav: Nav }) {
  const { data: p, error, retry } = useData(() => getProgramme(resume.id), [resume.id]);
  if (error && !p) return <ErreurChargement onRetry={retry} compact />;
  if (!p) return <Chargement />;
  const chiffrees = p.comptes.chiffrees > 0 ? `dont ${nombre(p.comptes.chiffrees)} ${pluriel(p.comptes.chiffrees, "chiffrée", "chiffrées")} par le parti` : "aucune mesure chiffrée par le parti";
  return (
    <View style={{ gap: 12, marginTop: 12 }}>
      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, padding: 16, gap: 14 }}>
        <View style={{ gap: 2 }}>
          <Kicker style={tnum}>Publié le {dateLongue(p.publieLe)}</Kicker>
          <Text accessibilityRole="header" style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Promis face aux votes du groupe</Text>
          <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>
            {nombre(p.comptes.mesures)} mesures, {chiffrees}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <AnneauxSelections p={p} perimetre={null} filtre="toutes" taille={120} />
          <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
            {SELECTIONS.map((s) => (
              <View key={s.id} style={{ gap: 1 }}>
                <Text style={[T.small, { fontFamily: F.extra, color: C.text, lineHeight: 16 }]}>{s.nom}</Text>
                <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{echelleSelection(p, s.id)}</Text>
                <LigneComptes texte={ligneComptes(p.verdicts[s.id])} />
              </View>
            ))}
          </View>
        </View>
        <Pression
          onPress={() => nav.push({ name: "programme", programme: p.id })}
          accessibilityRole="button"
          accessibilityLabel={`Voir le programme 2027 de ${p.parti}`}
          style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: RADIUS.md, backgroundColor: C.accent, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={[T.callout, { fontFamily: F.extra, color: C.onAccent }]}>Voir le programme</Text>
          <Feather name="chevron-right" size={18} color={C.onAccent} />
        </Pression>
      </View>
      <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>
        Ce sous-onglet apparaît quand le programme 2027 du parti est publié et confronté aux votes.
      </Text>
    </View>
  );
}
