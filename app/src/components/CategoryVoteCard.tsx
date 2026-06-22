import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { catUI } from "../categoryUI";
import { SEUIL_FIABILITE } from "../config";
import { PositionCells } from "./PositionCells";
import type { CategorieStats } from "../types";

/**
 * Carte "thème" de la fiche député, **repliable** (comme la fiche parti). Repliée :
 * en-tête + résumé. Dépliée : gros boutons Pour / Contre / Abst. / Absent (composant
 * partagé `PositionCells`), chacun cliquable vers la liste filtrée, + lien « tous les votes ».
 */
export function CategoryVoteCard({
  cat,
  ouvert,
  onToggle,
  onTitle,
  onCell,
}: {
  cat: CategorieStats;
  ouvert: boolean;
  onToggle: () => void;
  onTitle: () => void;
  onCell: (position: string) => void;
}) {
  const ui = catUI(cat.id);
  const total = cat.total;
  const exprimes = cat.pour + cat.contre + cat.abstention; // base de fiabilité
  const fiable = exprimes >= SEUIL_FIABILITE;

  const cells = [
    { pos: "pour", n: cat.pour, label: "Pour", color: C.pour },
    { pos: "contre", n: cat.contre, label: "Contre", color: C.contre },
    { pos: "abstention", n: cat.abstention, label: "Abst.", color: C.abstention },
    { pos: "absent", n: cat.absent, label: "Absent", color: C.textFaint },
  ];

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={onToggle}
        style={{ flexDirection: "row", alignItems: "center", gap: 11 }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={17} color={ui.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{cat.libelle}</Text>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint, marginTop: 1 }}>
            {exprimes} vote{exprimes > 1 ? "s" : ""} exprimé{exprimes > 1 ? "s" : ""} · {total} scrutins
          </Text>
        </View>
        <Feather name={ouvert ? "chevron-up" : "chevron-down"} size={18} color={C.textFaint} />
      </TouchableOpacity>

      {ouvert && (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }}>
          {fiable ? (
            <PositionCells cells={cells} onCell={onCell} />
          ) : (
            <View style={{ backgroundColor: C.surfaceSunken, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 12, alignItems: "center" }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 12.5, color: C.textMuted, textAlign: "center" }}>
                {exprimes === 0 ? "Aucun vote nominatif" : `${exprimes} vote${exprimes > 1 ? "s" : ""} nominatif${exprimes > 1 ? "s" : ""}`} — trop peu pour dégager une position
              </Text>
            </View>
          )}

          {fiable && cat.nonvotant > 0 && (
            <TouchableOpacity activeOpacity={0.6} onPress={() => onCell("nonvotant")} style={{ marginTop: 9 }}>
              <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint }}>
                dont <Text style={{ fontFamily: F.bold, color: C.textMuted }}>{cat.nonvotant} non votant·e·s</Text> · présent·e, n'a pas pris part ›
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={onTitle} style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 12.5, color: C.accent }}>Voir tous les votes du thème</Text>
            <Feather name="chevron-right" size={15} color={C.accent} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
