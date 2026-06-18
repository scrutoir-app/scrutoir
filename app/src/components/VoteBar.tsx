import React from "react";
import { View } from "react-native";
import { C } from "../theme";

export function VoteBar({
  pour,
  contre,
  abstention,
  absent,
  height = 8,
}: {
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  height?: number;
}) {
  const total = pour + contre + abstention + absent || 1;
  const seg = (v: number, color: string) =>
    v > 0 ? <View key={color} style={{ flex: v / total, backgroundColor: color }} /> : null;
  return (
    <View
      style={{
        flexDirection: "row",
        height,
        borderRadius: height / 2,
        overflow: "hidden",
        backgroundColor: C.surfaceAlt,
      }}
    >
      {seg(pour, C.pour)}
      {seg(contre, C.contre)}
      {seg(abstention, C.abstention)}
      {seg(absent, C.absent)}
    </View>
  );
}
