import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, CONTROL, tnum } from "../theme";
import { ANCRE_VOTES_HORS_TEST } from "../content/infos";
import type { CompteursVotes } from "../testProximite/jeProximite";
import type { Nav } from "../nav";

/**
 * D'où vient un « % comme toi » quand l'utilisateur a tranché des scrutins HORS du test :
 *  · encart « Sur le test seul : M % » (le test, même pour tout le monde, reste la référence) ;
 *  · détail repliable « D'où viennent tes votes » (test, tranchés depuis un scrutin, hors calcul,
 *    sans avis) et « Comment ils pèsent », avec le lien vers Infos.
 * Rien sans vote tranché hors du test : la fiche reste telle qu'elle était.
 */
export function OrigineVotes({ compteurs, testSeul, nav }: { compteurs: CompteursVotes; testSeul?: number | null; nav: Nav }) {
  const [ouvert, setOuvert] = useState(false);
  if (compteurs.perso + compteurs.horsCalcul <= 0) return null;
  return (
    <View style={{ marginTop: S.s8, gap: S.s8 }}>
      {compteurs.perso > 0 && testSeul != null && (
        <View style={{ backgroundColor: C.surfaceSunken, borderRadius: RADIUS.sm, paddingVertical: S.s10, paddingHorizontal: S.s12 }}>
          <Text style={[T.small, { color: C.text, lineHeight: 18 }]}>
            Sur le test seul : <Text style={[tnum, { fontFamily: F.extra }]}>{Math.round(testSeul * 100)}{" "}%</Text>. Le test est le même pour tout le monde, c'est ta référence.
          </Text>
        </View>
      )}

      <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border }}>
        <TouchableOpacity
          onPress={() => setOuvert((o) => !o)}
          accessibilityRole="button"
          aria-expanded={ouvert}
          accessibilityState={{ expanded: ouvert }}
          style={{ flexDirection: "row", alignItems: "center", gap: S.s8, minHeight: CONTROL.md, paddingHorizontal: S.s14 }}
        >
          <Text style={[T.callout, { flex: 1, fontFamily: F.bold, color: C.text }]}>D'où viennent tes votes</Text>
          <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={ICON.md} color={C.textFaint} />
        </TouchableOpacity>
        {ouvert && (
          <View style={{ paddingHorizontal: S.s14, paddingBottom: S.s14, gap: S.s8 }}>
            <Ligne label="Test de proximité" n={compteurs.test} fort />
            <Ligne label="Tranchés depuis un scrutin" n={compteurs.perso} fort />
            <View style={{ height: 1, backgroundColor: C.border }} />
            <Ligne label="Budgets et motions, hors calcul" n={compteurs.horsCalcul} />
            <Ligne label="Sans avis, hors calcul" n={compteurs.sansAvis} />

            <Text accessibilityRole="header" style={[T.callout, { fontFamily: F.bold, color: C.text, marginTop: S.s8 }]}>Comment ils pèsent</Text>
            <Text style={[T.small, { color: C.textMuted, lineHeight: 18 }]}>
              Un vote tranché hors du test rejoint son thème. Dans chaque thème, tes votes hors test ne pèsent jamais plus que les questions du test.
            </Text>
            <TouchableOpacity
              onPress={() => nav.push({ name: "apropos", ancre: ANCRE_VOTES_HORS_TEST })}
              accessibilityRole="link"
              style={{ alignSelf: "flex-start", minHeight: CONTROL.md, justifyContent: "center" }}
            >
              <Text style={[T.small, { fontFamily: F.bold, color: C.accent, textDecorationLine: "underline" }]}>Comment tes votes comptent</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function Ligne({ label, n, fort = false }: { label: string; n: number; fort?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: S.s12 }}>
      <Text style={[T.small, { flex: 1, color: fort ? C.text : C.textMuted }]}>{label}</Text>
      <Text style={[T.small, tnum, { fontFamily: fort ? F.extra : F.bold, color: fort ? C.text : C.textMuted }]}>{n}</Text>
    </View>
  );
}
