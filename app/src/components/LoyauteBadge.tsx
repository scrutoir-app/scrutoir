import React from "react";
import { View, Text } from "react-native";
import { couleurLoyaute } from "../theme";

/** Petite pastille de loyauté (vert/ambre/rouge) affichant le pourcentage. */
export function LoyautePill({ pct }: { pct: number | null }) {
  const { fg, bg } = couleurLoyaute(pct);
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "500" }}>
        {pct == null ? "—" : `${pct}%`}
      </Text>
    </View>
  );
}
