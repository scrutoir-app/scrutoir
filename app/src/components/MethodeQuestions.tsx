import React from "react";
import { View, Text, type TextStyle } from "react-native";
import { C, F, T, S } from "../theme";
import { METHODE_QUESTIONS, METHODE_VOTES_HORS_TEST, type Methode, type RegleMethode } from "../content/infos";

// Niveau de titre (h1, h3) : RN ne type pas `aria-level`, react-native-web le lit.
const niveau = (n: 1 | 3) => ({ "aria-level": n }) as object;

/** Une règle : son nom en gras, puis le texte après les deux-points (insécable devant « : »). */
function Regle({ r, corps, haut }: { r: RegleMethode; corps: TextStyle; haut: number }) {
  return (
    <Text style={[corps, { color: C.textMuted, marginTop: haut }]}>
      <Text style={{ fontFamily: F.bold, color: C.text }}>{r.nom}</Text>
      {" : "}
      {r.texte}
    </Text>
  );
}

/**
 * Un texte de méthode (titre, introduction, règles, règle-limite ou pied), mot pour mot.
 * Deux présentations, même texte :
 * - `bloc` : un bloc de la famille « Le test de proximité » de l'onglet Infos (cran `small`) ;
 * - `page` : un écran à part (cran `body`, plus aéré).
 */
export function MethodeTexte({ methode, variante }: { methode: Methode; variante: "bloc" | "page" }) {
  const page = variante === "page";
  const corps: TextStyle = { ...(page ? T.body : T.small), lineHeight: page ? 22 : 18 };
  return (
    <View>
      <Text
        accessibilityRole="header"
        {...niveau(page ? 1 : 3)}
        style={page ? [T.title, { color: C.text }] : [T.small, { fontFamily: F.bold, color: C.text }]}
      >
        {methode.titre}
      </Text>
      <Text style={[corps, { color: C.textMuted, marginTop: page ? S.s12 : S.s4 }]}>{methode.intro}</Text>
      {methode.regles.map((r) => (
        <Regle key={r.nom} r={r} corps={corps} haut={page ? S.s12 : S.s8} />
      ))}
      {methode.limite && <Regle r={methode.limite} corps={corps} haut={page ? S.s20 : S.s12} />}
      {!!methode.pied && <Text style={[corps, { color: C.textMuted, marginTop: page ? S.s20 : S.s12 }]}>{methode.pied}</Text>}
    </View>
  );
}

/** « Comment on choisit les questions du test » (onglet Infos et lien de l'intro du test). */
export function MethodeQuestions({ variante }: { variante: "bloc" | "page" }) {
  return <MethodeTexte methode={METHODE_QUESTIONS} variante={variante} />;
}

/** « Comment tes votes hors du test comptent » (onglet Infos, ancre des liens de la fiche). */
export function MethodeVotesHorsTest({ variante }: { variante: "bloc" | "page" }) {
  return <MethodeTexte methode={METHODE_VOTES_HORS_TEST} variante={variante} />;
}
