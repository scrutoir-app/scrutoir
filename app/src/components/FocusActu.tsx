import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, CONTROL, ICON, tnum } from "../theme";
import { catUI } from "../categoryUI";
import { FOCUS } from "../content/focus";
import { useFocusActu } from "../hooks/useHebdo";
import { libelleDate, metaFocus, type TexteHebdo } from "../hebdo";
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
  if (!FOCUS || !textes || textes.length === 0) return null;

  const pastille = FOCUS.categorie ? catUI(FOCUS.categorie).fg : C.accent;
  const liste = ouvert ? textes : textes.slice(0, VISIBLES);
  const reste = textes.length - VISIBLES;
  const ouvrir = (t: TexteHebdo) =>
    t.dossierRef ? nav.push({ name: "dossierScrutins", ref: t.dossierRef, titre: t.titre }) : nav.push({ name: "scrutin", uid: t.scrutinUid });

  return (
    <View style={{ marginHorizontal: 16, marginTop: 22, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.lg, paddingHorizontal: 16, paddingTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: pastille }} />
        <Text style={[T.micro, { fontFamily: F.bold, color: C.textMuted }]}>Focus actualité</Text>
      </View>
      <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>{FOCUS.titre}</Text>
      <Text style={[T.small, { color: C.textMuted, marginTop: 6 }]}>{FOCUS.contexte}</Text>

      <View style={{ marginTop: 14 }}>
        {liste.map((t, i) => (
          <View key={t.cle} style={{ flexDirection: "row", gap: 12 }}>
            {/* Frise : un point par texte, relié au suivant. */}
            <View style={{ width: 10, alignItems: "center" }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: pastille }} />
              {i < liste.length - 1 && <View style={{ flex: 1, width: 1.5, marginTop: 4, backgroundColor: C.borderStrong }} />}
            </View>
            <TouchableOpacity activeOpacity={0.6} onPress={() => ouvrir(t)} accessibilityRole="button" style={{ flex: 1, paddingBottom: 16 }}>
              <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }]}>{libelleDate(t.derniereDate)}</Text>
              <Text style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: 3 }]}>{t.titre}</Text>
              <Text style={[T.micro, tnum, { color: C.textMuted, marginTop: 4 }]}>{metaFocus(t)}</Text>
            </TouchableOpacity>
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
