import React from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, formatDate } from "../theme";
import { Card, Chip } from "./ui";
import { VoteBarDivergenteCentree } from "./VoteBarDivergenteCentree";
import { VerdictPastille } from "./VerdictPastille";
import { useScrutinGroupes } from "../scrutinGroupes";
import { verdictScrutin } from "../testProximite/verdict";
import { catUI } from "../categoryUI";
import type { ContexteJe } from "../testProximite/jeProximite";
import type { Reponse } from "../testProximite/score";
import type { ScrutinResume } from "../types";

/**
 * Carte compacte de la vue LISTE. PAS de filigrane de fond (réservé au Fil) : à la place,
 * l'icône du thème (teintée) est posée devant le nom de la catégorie. Barre divergente
 * officielle + verdict à deux niveaux. Zones tactiles SÉPARÉES (pas de Touchable imbriqué) :
 * le corps ouvre la fiche, la pastille ouvre la légende — l'un n'ouvre jamais l'autre.
 */
export function ListeScrutinCard({
  scrutin,
  ctx,
  situe,
  reponse,
  onDetail,
  onVerdict,
}: {
  scrutin: ScrutinResume;
  ctx: ContexteJe | null;
  situe: boolean;
  reponse: Reponse | undefined;
  onDetail: () => void;
  onVerdict: () => void;
}) {
  const detail = useScrutinGroupes(scrutin.uid);
  const adopte = scrutin.sort_code === "adopte";
  const ui = catUI(scrutin.categorie ?? "");
  const catLabel = ui.court ?? scrutin.categorie ?? "";
  const titre = scrutin.dossier_titre || scrutin.titre || "Scrutin";
  const verdict = verdictScrutin({ ctx, situe, reponse, groupes: detail?.pos ?? [], sortCode: scrutin.sort_code });

  return (
    <Card padding={S.s14} bordered style={{ marginBottom: 11 }}>
      {/* Corps cliquable → fiche détail (zone tactile distincte de la pastille) */}
      <Pressable onPress={onDetail} accessibilityRole="button" accessibilityLabel={`Scrutin : ${titre}`}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: S.s8, marginBottom: 9 }}>
          <View style={{ width: 24, height: 24, borderRadius: RADIUS.sm, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
            <MaterialCommunityIcons name={ui.icon as any} size={ICON.sm} color={ui.fg} />
          </View>
          <Text style={[T.micro, { fontFamily: F.extra, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.3 }]}>{catLabel}</Text>
          <View style={{ flex: 1 }} />
          <Chip label={adopte ? "Adopté" : "Rejeté"} bg={adopte ? C.adopteBg : C.rejeteBg} fg={adopte ? C.adopteFg : C.rejeteFg} />
        </View>

        <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={3}>{titre}</Text>

        <View style={{ marginTop: S.s12 }}>
          <VoteBarDivergenteCentree
            pour={scrutin.pour ?? 0}
            contre={scrutin.contre ?? 0}
            abstention={scrutin.abstention ?? 0}
            height={8}
            active
            decompte
          />
        </View>

        {scrutin.date && (
          <Text style={[T.micro, { color: C.textFaint, marginTop: S.s6 }]}>{formatDate(scrutin.date)} · scrutin public</Text>
        )}
      </Pressable>

      {/* Verdict : zone tactile propre → ouvre la légende, jamais la fiche */}
      <View style={{ marginTop: 11, alignSelf: "flex-start" }}>
        <VerdictPastille verdict={verdict} onPress={onVerdict} />
      </View>
    </Card>
  );
}
