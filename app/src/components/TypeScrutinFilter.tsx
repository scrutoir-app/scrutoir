import React from "react";
import { Text, TouchableOpacity, ScrollView } from "react-native";
import { C, F, T, RADIUS } from "../theme";
import type { TypeScrutin, ComptesType } from "../typeScrutin";

const NOMMES: { key: Exclude<TypeScrutin, "tous">; label: string }[] = [
  { key: "projet", label: "Projet" },
  { key: "proposition", label: "Proposition" },
  { key: "amendement", label: "Amendement" },
];

/** Chip à sélection unique — actif : fond accent + texte onAccent ; inactif : surface + filet. */
function ChipType({
  label, count, active, onPress,
}: { label: string; count?: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: "row", alignItems: "center", gap: 5,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
        backgroundColor: active ? C.accent : C.surface,
        borderWidth: 1, borderColor: active ? C.accent : C.borderStrong,
      }}
    >
      <Text style={[T.small, { fontFamily: active ? F.bold : F.medium, color: active ? C.onAccent : C.textMuted }]}>
        {label}
      </Text>
      {count != null && (
        <Text style={[T.small, { fontFamily: F.bold, color: active ? C.onAccent : C.textFaint }]}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Filtre à sélection unique par type de scrutin : « Tout » (toujours) puis un chip par type
 * NON VIDE parmi Projet / Proposition / Amendement, avec son compte. La décision de MONTRER
 * le filtre (≥ 2 types présents) et le garde-fou « tous » vivent côté écran
 * (`doitAfficherFiltreType` / `typeEffectif` de `../typeScrutin`).
 */
export function TypeScrutinFilter({
  value, onChange, counts,
}: {
  value: TypeScrutin;
  onChange: (t: TypeScrutin) => void;
  counts: ComptesType;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
      <ChipType label="Tout" active={value === "tous"} onPress={() => onChange("tous")} />
      {NOMMES.map(({ key, label }) =>
        counts[key] > 0 ? (
          <ChipType
            key={key}
            label={label}
            count={counts[key]}
            active={value === key}
            onPress={() => onChange(key)}
          />
        ) : null
      )}
    </ScrollView>
  );
}
