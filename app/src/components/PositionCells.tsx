import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { C, F } from "../theme";

export interface PositionCell {
  pos: string;
  n: number;
  label: string;
  color: string;
}

/**
 * Rangée de « gros boutons » de position (Pour / Contre / Abst. / Absent…), partagée
 * entre la fiche député (CategoryVoteCard) et la fiche parti (PartiThemeRow) pour que
 * le détail d'un thème s'affiche de la même façon partout. Chaque case est cliquable
 * (vers la liste filtrée) ; désactivée si vide.
 */
export function PositionCells({ cells, onCell }: { cells: PositionCell[]; onCell: (position: string) => void }) {
  return (
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
  );
}
