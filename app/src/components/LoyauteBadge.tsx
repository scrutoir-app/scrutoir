import React from "react";
import { View, Text } from "react-native";
import { couleurLoyaute, T, tnum } from "../theme";

/** Petite pastille de loyauté (vert/ambre/rouge) affichant le pourcentage. */
export function LoyautePill({ pct }: { pct: number | null }) {
  const { fg, bg } = couleurLoyaute(pct);
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={[T.micro, tnum, { color: fg, fontWeight: "500" }]}>
        {pct == null ? "—" : `${pct}%`}
      </Text>
    </View>
  );
}
