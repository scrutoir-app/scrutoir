// Tous les programmes : texte seul, aucun graphique, du plus récent au plus ancien.
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { Nav } from "../../nav";
import type { ProgrammeResume } from "../../presidentielle/types";
import { ordonnerProgrammes, rubriqueVisible } from "../../presidentielle/logique";
import { useIndexPresidentielle } from "../../presidentielle/donnees";
import { dateLongue, nombre, pluriel } from "../../presidentielle/libelles";
import { Entree, Kicker, Pression } from "../../components/presidentielle/primitives";
import { FeuilleMethode } from "../../components/presidentielle/FeuilleMethode";
import { track } from "../../analytics";
import { Chargement, LienMethode, MARGE, useRenvoiAccueil } from "./commun";

export function ligneProgramme(p: ProgrammeResume): string {
  const chiffrees = p.chiffrees > 0 ? `dont ${nombre(p.chiffrees)} ${pluriel(p.chiffrees, "chiffrée", "chiffrées")} par le parti` : "aucune mesure chiffrée par le parti";
  const mesures = `${nombre(p.mesures)} ${pluriel(p.mesures, "mesure", "mesures")}, ${chiffrees}`;
  return p.groupe ? `Face au groupe ${p.groupe.abrev} · ${mesures}` : `Sans groupe à l’Assemblée, affiché sans confrontation · ${mesures}`;
}

export function HubScreen({ nav }: { nav: Nav }) {
  const index = useIndexPresidentielle();
  const [methode, setMethode] = useState(false);
  useRenvoiAccueil(!!index && !rubriqueVisible(index), nav);
  if (!index || !rubriqueVisible(index)) return <Chargement />;
  const programmes = ordonnerProgrammes(index.programmes);
  const ouvrirMethode = () => {
    track("methode_open", "", "hub");
    setMethode(true);
  };
  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: MARGE, paddingTop: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Entree cle="hub" gap={12}>
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={[T.title, { color: C.text }]}>Présidentielle 2027</Text>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>
              Les programmes dans l’ordre de leur sortie, le plus récent en haut. Chaque mesure face aux votes du groupe du même parti à l’Assemblée.
            </Text>
            <LienMethode onPress={ouvrirMethode} />
          </View>
          <Kicker>Publiés · {nombre(programmes.length)}</Kicker>
          {programmes.map((p) => (
            <Pression
              key={p.id}
              disabled={!p.groupe}
              onPress={() => nav.push({ name: "programme", programme: p.id })}
              accessibilityRole="button"
              accessibilityLabel={`${p.parti}, publié le ${dateLongue(p.publieLe)}. ${ligneProgramme(p)}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: C.surface, borderRadius: RADIUS.md }}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Kicker style={tnum}>Publié le {dateLongue(p.publieLe)}</Kicker>
                <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>{p.parti}</Text>
                <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>{ligneProgramme(p)}</Text>
              </View>
              {!!p.groupe && <Feather name="chevron-right" size={18} color={C.textFaint} />}
            </Pression>
          ))}
          <View style={{ padding: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.borderStrong, borderRadius: RADIUS.md }}>
            <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>
              Le prochain programme publié s’ajoute en haut de la liste, passé au même crible.
            </Text>
          </View>
          <Text style={[T.micro, { color: C.textFaint, lineHeight: 15 }]}>
            Un programme dont le parti n’a pas de groupe à l’Assemblée est affiché sans confrontation : aucun vote à lui opposer.
          </Text>
        </Entree>
      </ScrollView>
      <FeuilleMethode visible={methode} onClose={() => setMethode(false)} chiffres={null} base={programmes[0]?.base ?? null} />
    </>
  );
}
