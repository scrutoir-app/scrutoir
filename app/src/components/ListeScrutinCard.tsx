import React from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, RADIUS, S, ICON, formatDate } from "../theme";
import { Card, Chip } from "./ui";
import { VoteBarDivergenteCentree } from "./VoteBarDivergenteCentree";
import { PastilleVote } from "./PastilleVote";
import { useScrutinGroupes } from "../scrutinGroupes";
import { catUI } from "../categoryUI";
import type { ContexteJe } from "../testProximite/jeProximite";
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
  annotation,
  onDetail,
  onVerdict,
}: {
  scrutin: ScrutinResume;
  ctx: ContexteJe | null;
  situe: boolean;
  annotation?: React.ReactNode; // slot par-item propre à l'écran (ex. consigne du groupe / écart)
  onDetail: () => void;
  onVerdict: () => void;
}) {
  const detail = useScrutinGroupes(scrutin.uid);
  // Hydratation depuis le détail déjà chargé (données sparse : Dissidence sans sort_code/comptes/catégorie).
  const r = detail?.resume;
  const adopte = (scrutin.sort_code ?? r?.sort_code) === "adopte";
  const categorieId = scrutin.categorie ?? r?.categorie ?? null;
  const ui = catUI(categorieId ?? "");
  const catLabel = ui.court ?? categorieId ?? "";
  const titre = scrutin.dossier_titre || scrutin.titre || r?.dossier_titre || r?.titre || "Scrutin";

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
            pour={scrutin.pour ?? r?.pour ?? 0}
            contre={scrutin.contre ?? r?.contre ?? 0}
            abstention={scrutin.abstention ?? r?.abstention ?? 0}
            height={8}
            active
            decompte
          />
        </View>

        {(scrutin.date ?? r?.date) && (
          <Text style={[T.micro, { color: C.textFaint, marginTop: S.s6 }]}>{formatDate((scrutin.date ?? r?.date)!)} · scrutin public</Text>
        )}
      </Pressable>

      {/* Verdict : zone tactile propre → ouvre le tiroir de vote (ou l'onboarding si verrouillé),
          jamais la fiche */}
      <PastilleVote
        uid={scrutin.uid}
        numero={scrutin.numero ?? r?.numero ?? null}
        sortCode={scrutin.sort_code ?? r?.sort_code ?? null}
        groupes={detail?.pos ?? []}
        ctx={ctx}
        situe={situe}
        onVerrouille={onVerdict}
        style={{ marginTop: 11 }}
      />
      {annotation != null && <View style={{ marginTop: 10 }}>{annotation}</View>}
    </Card>
  );
}
