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
 * Filtre pour une liste de scrutins (listes denses). Retourne la liste filtrée + une barre
 * de chips : résultat (Adoptés / Rejetés, si la liste mélange les deux), puis année, puis
 * mois de l'année choisie. À placer dans le ListHeaderComponent ; appeler le hook AVANT
 * tout return conditionnel. `sort_code` est optionnel → le filtre résultat ne s'affiche que
 * quand la donnée s'y prête.
 */
export function useScrutinDateFilter<T extends { date: string | null; sort_code?: string | null }>(items: T[]) {
  const [year, setYear] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [result, setResult] = useState<"adopte" | "rejete" | null>(null);

  const years = useMemo(
    () => [...new Set(items.map((i) => i.date?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(),
    [items]
  );
  const monthsOfYear = useMemo(() => {
    if (!year) return [];
    return [...new Set(items.filter((i) => i.date?.slice(0, 4) === year).map((i) => i.date!.slice(5, 7)))].sort();
  }, [items, year]);

  // Résultat : on ne propose le filtre que si la liste contient À LA FOIS des adoptés et des
  // rejetés (sinon le toggle n'a aucun sens). « Rejeté » = tout ce qui n'est pas « adopte »
  // (cohérent avec le badge de ScrutinCard).
  const hasAdopte = useMemo(() => items.some((i) => i.sort_code === "adopte"), [items]);
  const hasRejete = useMemo(() => items.some((i) => i.sort_code != null && i.sort_code !== "adopte"), [items]);
  const showResult = hasAdopte && hasRejete;

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (year) {
          if (i.date?.slice(0, 4) !== year) return false;
          if (month && i.date?.slice(5, 7) !== month) return false;
        }
        if (result === "adopte" && i.sort_code !== "adopte") return false;
        if (result === "rejete" && i.sort_code === "adopte") return false;
        return true;
      }),
    [items, year, month, result]
  );

  const showDates = years.length > 1;

  const Bar =
    !showResult && !showDates ? null : (
      <View>
        {showResult && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
            <Chip label="Tous résultats" active={!result} onPress={() => setResult(null)} />
            <Chip label="Adoptés" active={result === "adopte"} onPress={() => setResult("adopte")} />
            <Chip label="Rejetés" active={result === "rejete"} onPress={() => setResult("rejete")} />
          </ScrollView>
        )}
        {showDates && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7, paddingVertical: 2, marginTop: showResult ? 6 : 0 }}
          >
            <Chip label="Toutes dates" active={!year} onPress={() => { setYear(null); setMonth(null); }} />
            {years.map((y) => (
              <Chip key={y} label={y} active={year === y} onPress={() => { setYear(y); setMonth(null); }} />
            ))}
          </ScrollView>
        )}
        {showDates && year && monthsOfYear.length > 1 && (
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
