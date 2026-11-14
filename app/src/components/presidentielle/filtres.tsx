// Filtres d'une liste de mesures : Toutes / = cohérentes / ≠ tensions / ∅ neutres, avec les comptes
// du périmètre, la ligne de détail du neutre et, sur ∅, les puces de sous-cas. Instantanés, sans
// animation ; vrais boutons avec état « sélectionné ».
import React from "react";
import { Text, View } from "react-native";
import { C, F, T, tnum, RADIUS } from "../../theme";
import type { Comptes, Filtre, SousNeutre } from "../../presidentielle/types";
import { neutres, confrontables } from "../../presidentielle/logique";
import { EXPLICATION_NEUTRE, detailNeutre, nombre } from "../../presidentielle/libelles";
import { Bloc, Pression, retourSelection } from "./primitives";

const FILTRES: { id: Filtre; haut: (k: Comptes) => string; bas: string; lu: (k: Comptes) => string }[] = [
  { id: "toutes", haut: (k) => nombre(confrontables(k)), bas: "toutes", lu: (k) => `Toutes les mesures, ${nombre(confrontables(k))}` },
  { id: "c", haut: (k) => `= ${nombre(k.c)}`, bas: "cohérentes", lu: (k) => `Cohérentes, ${nombre(k.c)}` },
  { id: "t", haut: (k) => `≠ ${nombre(k.t)}`, bas: "tensions", lu: (k) => `Tensions, ${nombre(k.t)}` },
  { id: "n", haut: (k) => `∅ ${nombre(neutres(k))}`, bas: "neutres", lu: (k) => `Neutres, ${nombre(neutres(k))}` },
];

const PUCES: { id: SousNeutre; libelle: string; n: (k: Comptes) => number }[] = [
  { id: "tout", libelle: "Les", n: neutres },
  { id: "s", libelle: "Sans scrutin public", n: (k) => k.s },
  { id: "j", libelle: "À juger", n: (k) => k.j },
  { id: "r", libelle: "Sans vote représentatif", n: (k) => k.r },
];

export function FiltresVerdict({
  comptes,
  filtre,
  sous,
  onChange,
}: {
  comptes: Comptes;
  filtre: Filtre;
  sous: SousNeutre;
  onChange: (f: Filtre, s: SousNeutre) => void;
}) {
  const detail = detailNeutre(comptes);
  return (
    <Bloc style={{ paddingVertical: 8, paddingHorizontal: 6, gap: 10 }}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Filtrer les mesures" style={{ flexDirection: "row", gap: 2 }}>
        {FILTRES.map((f) => {
          const sel = filtre === f.id;
          return (
            <View key={f.id} style={{ flex: 1, minWidth: 0 }}>
              <Pression
                onPress={() => {
                  if (sel) return;
                  retourSelection();
                  onChange(f.id, "tout");
                }}
                accessibilityLabel={f.lu(comptes)}
                accessibilityState={{ selected: sel }}
                style={{
                  minHeight: 52,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  backgroundColor: sel ? C.surfaceSunken : "transparent",
                }}
              >
                <Text numberOfLines={1} style={[T.callout, tnum, { fontFamily: F.extra, color: sel ? C.text : C.textMuted }]}>{f.haut(comptes)}</Text>
                <Text numberOfLines={1} style={[T.micro, { fontFamily: F.bold, color: sel ? C.text : C.textMuted }]}>{f.bas}</Text>
              </Pression>
            </View>
          );
        })}
      </View>

      {filtre !== "n" ? (
        !!detail && (
          <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted, paddingHorizontal: 8, paddingBottom: 4, lineHeight: 18 }]}>
            <Text style={{ fontFamily: F.extra, color: C.text }}>∅ Neutre : </Text>
            {detail}
          </Text>
        )
      ) : (
        <View style={{ gap: 8, paddingHorizontal: 8, paddingBottom: 6 }}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Détail du neutre" style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {PUCES.filter((p) => p.id === "tout" || p.n(comptes) > 0).map((p) => {
              const sel = sous === p.id;
              return (
                <Pression
                  key={p.id}
                  onPress={() => {
                    if (sel) return;
                    retourSelection();
                    onChange("n", p.id);
                  }}
                  accessibilityLabel={`${p.id === "tout" ? "Les neutres" : p.libelle}, ${nombre(p.n(comptes))}`}
                  accessibilityState={{ selected: sel }}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={{
                    minHeight: 36,
                    justifyContent: "center",
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.pill,
                    borderWidth: 1.5,
                    borderColor: sel ? C.accent : C.borderStrong,
                    backgroundColor: sel ? C.accent : C.surface,
                  }}
                >
                  <Text style={[T.small, { fontFamily: F.bold, color: sel ? C.onAccent : C.text }]}>
                    {p.libelle} <Text style={[tnum, { fontFamily: F.extra }]}>{nombre(p.n(comptes))}</Text>
                  </Text>
                </Pression>
              );
            })}
          </View>
          <Text style={[T.small, { fontFamily: F.semibold, color: C.textMuted, lineHeight: 18 }]}>{EXPLICATION_NEUTRE[sous]}</Text>
        </View>
      )}
    </Bloc>
  );
}
