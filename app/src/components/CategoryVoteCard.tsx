import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { C, F, RADIUS, shadowCard } from "../theme";
import { catUI } from "../categoryUI";
import type { CategorieStats } from "../types";

/**
 * Carte "thème" de la fiche député. Tout est cliquable :
 * - le titre → tous les votes du thème (groupés par position)
 * - chaque case (Pour / Contre / Abst. / Absent) → la liste filtrée correspondante
 */
export function CategoryVoteCard({
  cat,
  onTitle,
  onCell,
}: {
  cat: CategorieStats;
  onTitle: () => void;
  onCell: (position: string) => void;
}) {
  const ui = catUI(cat.id);
  const total = cat.total;

  const cells: Array<{ pos: string; n: number; label: string; color: string }> = [
    { pos: "pour", n: cat.pour, label: "Pour", color: C.pour },
    { pos: "contre", n: cat.contre, label: "Contre", color: C.contre },
    { pos: "abstention", n: cat.abstention, label: "Abst.", color: C.abstention },
    { pos: "absent", n: cat.absent, label: "Absent", color: C.textFaint },
  ];

  return (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 13, ...shadowCard }}>
      <TouchableOpacity
        activeOpacity={0.6}
        onPress={onTitle}
        style={{
          flexDirection: "row", alignItems: "center", gap: 11,
          paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 11,
        }}
      >
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={ui.icon as any} size={17} color={ui.fg} />
        </View>
        <Text style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text }}>{cat.libelle}</Text>
        <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.textFaint }}>{total} scrutins</Text>
        <Feather name="chevron-right" size={18} color={C.textFaint} />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: 7 }}>
        {cells.map((c) => (
          <TouchableOpacity
            key={c.pos}
            activeOpacity={0.6}
            disabled={c.n === 0}
            onPress={() => onCell(c.pos)}
            style={{
              flex: 1, backgroundColor: C.surfaceSunken, borderRadius: 11,
              paddingVertical: 9, alignItems: "center", opacity: c.n === 0 ? 0.5 : 1,
            }}
          >
            <Text style={{ fontFamily: F.extra, fontSize: 18, color: c.color, letterSpacing: -0.3 }}>{c.n}</Text>
            <Text style={{ fontFamily: F.semibold, fontSize: 11, color: C.textMuted, marginTop: 3 }}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {cat.nonvotant > 0 && (
        <TouchableOpacity activeOpacity={0.6} onPress={() => onCell("nonvotant")} style={{ marginTop: 9 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 11, color: C.textFaint }}>
            dont <Text style={{ fontFamily: F.bold, color: C.textMuted }}>{cat.nonvotant} non votant·e·s</Text> · présent·e, n'a pas pris part ›
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
