import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { C, F, T } from "../theme";

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
        backgroundColor: active ? C.accent : C.surface,
        borderWidth: 1, borderColor: active ? C.accent : C.borderStrong,
      }}
    >
      <Text style={[T.small, { fontFamily: active ? F.bold : F.medium, color: active ? "#fff" : C.textMuted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Filtre mois/année pour une liste de scrutins (listes denses). Retourne la liste
 * filtrée + une barre de chips (année, puis mois de l'année choisie). À placer dans
 * le ListHeaderComponent ; appeler le hook AVANT tout return conditionnel.
 */
export function useScrutinDateFilter<T extends { date: string | null }>(items: T[]) {
  const [year, setYear] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  const years = useMemo(
    () => [...new Set(items.map((i) => i.date?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(),
    [items]
  );
  const monthsOfYear = useMemo(() => {
    if (!year) return [];
    return [...new Set(items.filter((i) => i.date?.slice(0, 4) === year).map((i) => i.date!.slice(5, 7)))].sort();
  }, [items, year]);

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (!year) return true;
        if (i.date?.slice(0, 4) !== year) return false;
        if (month && i.date?.slice(5, 7) !== month) return false;
        return true;
      }),
    [items, year, month]
  );

  const Bar =
    years.length <= 1 ? null : (
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
          <Chip label="Toutes dates" active={!year} onPress={() => { setYear(null); setMonth(null); }} />
          {years.map((y) => (
            <Chip key={y} label={y} active={year === y} onPress={() => { setYear(y); setMonth(null); }} />
          ))}
        </ScrollView>
        {year && monthsOfYear.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2, marginTop: 6 }}>
            <Chip label="Toute l'année" active={!month} onPress={() => setMonth(null)} />
            {monthsOfYear.map((m) => (
              <Chip key={m} label={MOIS[parseInt(m, 10) - 1] ?? m} active={month === m} onPress={() => setMonth(m)} />
            ))}
          </ScrollView>
        )}
      </View>
    );

  return { filtered, Bar };
}
