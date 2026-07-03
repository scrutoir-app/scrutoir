import React from "react";
import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, formatDate } from "../theme";
import { catUI } from "../categoryUI";
import { Card } from "./ui/Card";
import { Chip } from "./ui/Chip";
import type { ScrutinResume } from "../types";

/** Carte de scrutin façon "fil d'actu" : badge résultat, titre, répartition. */
export function ScrutinCard({ scrutin, onPress }: { scrutin: ScrutinResume; onPress: () => void }) {
  const adopte = scrutin.sort_code === "adopte";
  const p = scrutin.pour ?? 0;
  const c = scrutin.contre ?? 0;
  const a = scrutin.abstention ?? 0;
  const tot = p + c + a;
  const seg = (v: number, col: string) =>
    v ? <View key={col} style={{ flex: v / (tot || 1), backgroundColor: col }} /> : null;
  const ui = scrutin.categorie ? catUI(scrutin.categorie) : null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Scrutin ${adopte ? "adopté" : "rejeté"} : ${scrutin.titre || scrutin.objet || ""}`}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {ui && (
            <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: ui.bg, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name={ui.icon as any} size={15} color={ui.fg} />
            </View>
          )}
          <Chip
            label={adopte ? "Adopté" : "Rejeté"}
            bg={adopte ? C.adopteBg : C.rejeteBg}
            fg={adopte ? C.adopteFg : C.rejeteFg}
            radius={7}
            ph={9}
            pv={3}
          />
        </View>
        <Text style={[T.small, tnum, { color: C.textFaint }]}>{formatDate(scrutin.date)}</Text>
      </View>

      <Text style={[T.callout, { fontFamily: F.bold, color: C.text }]} numberOfLines={3}>
        {scrutin.titre || scrutin.objet}
      </Text>

      {tot > 0 && (
        <>
          <View style={{ flexDirection: "row", height: 7, borderRadius: 4, overflow: "hidden", backgroundColor: C.surfaceSunken, marginTop: 11 }}>
            {seg(p, C.pour)}
            {seg(c, C.contre)}
            {seg(a, C.abstention)}
          </View>
          <Text style={[T.small, tnum, { color: C.textMuted, marginTop: 7 }]}>
            {p} pour · {c} contre · {a} abst.
          </Text>
        </>
      )}
    </Card>
  );
}
