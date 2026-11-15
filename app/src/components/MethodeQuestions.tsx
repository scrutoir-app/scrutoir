import React from "react";
import { View, Text, type TextStyle } from "react-native";
import { C, F, T, S } from "../theme";
import { METHODE_QUESTIONS, type RegleMethode } from "../content/infos";

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
 * Le texte de méthode du test (« Comment on choisit les questions du test »), mot pour mot.
 * Deux présentations, même texte (source : `METHODE_QUESTIONS`) :
 * - `bloc` : un bloc de la famille « Le test de proximité » de l'onglet Infos (cran `small`) ;
 * - `page` : l'écran ouvert depuis l'intro du test (cran `body`, plus aéré).
 */
export function MethodeQuestions({ variante }: { variante: "bloc" | "page" }) {
  const page = variante === "page";
  const corps: TextStyle = { ...(page ? T.body : T.small), lineHeight: page ? 22 : 18 };
  return (
    <View>
      <Text
        accessibilityRole="header"
        {...niveau(page ? 1 : 3)}
        style={page ? [T.title, { color: C.text }] : [T.small, { fontFamily: F.bold, color: C.text }]}
      >
        {METHODE_QUESTIONS.titre}
      </Text>
      <Text style={[corps, { color: C.textMuted, marginTop: page ? S.s12 : S.s4 }]}>{METHODE_QUESTIONS.intro}</Text>
      {METHODE_QUESTIONS.regles.map((r) => (
        <Regle key={r.nom} r={r} corps={corps} haut={page ? S.s12 : S.s8} />
      ))}
      <Regle r={METHODE_QUESTIONS.limite} corps={corps} haut={page ? S.s20 : S.s12} />
    </View>
  );
}
