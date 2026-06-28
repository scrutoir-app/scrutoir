import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { HemicyclePicto } from "./HemicyclePicto";
import { SEUIL_FIABLE } from "../testProximite/jeProximite";
import type { PartiResume, CategorieRef } from "../types";
import type { ResultatProximite } from "../testProximite/score";

/**
 * « Par thème » — UN groupe à la fois, dans l'ordre de proximité décroissante (le plus
 * proche par défaut), navigable par flèches / points. Pour le groupe courant : convergence
 * globale + convergence par thème (barres à la couleur du groupe = identité, jamais le vote).
 * Remplace la matrice multi-colonnes (illisible sur mobile). Rien à afficher sans « je ».
 */
export function ParThemeSwipe({
  resultat,
  partis,
  cats,
}: {
  resultat: ResultatProximite;
  partis: PartiResume[];
  cats: CategorieRef[];
}) {
  const [i, setI] = useState(0);

  // Groupes classés par proximité (resultat.global est déjà trié décroissant), limités
  // aux groupes FIABLES (≥ SEUIL_FIABLE votes comparés) pour ne pas exposer de base trop
  // faible ; repli sur tous si aucun n'atteint le seuil.
  const groupes = useMemo(() => {
    const comparable = (abrev: string) =>
      Object.values(resultat.parTheme).reduce((s, t) => s + (t[abrev]?.comparable ?? 0), 0);
    const fiables = resultat.global.filter((g) => comparable(g.abrev) >= SEUIL_FIABLE);
    return fiables.length ? fiables : resultat.global;
  }, [resultat]);
  const n = groupes.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const courant = groupes[idx];

  const couleur = (abrev: string) => partis.find((p) => p.abrev === abrev)?.couleur ?? C.textFaint;
  const libelleParti = (abrev: string) => partis.find((p) => p.abrev === abrev)?.libelle ?? abrev;
  const libelleCat = (id: string) => cats.find((c) => c.id === id)?.libelle ?? id;
  // Libellé court (1ʳᵉ partie avant « & » / « , ») pour une colonne lisible, comme la maquette.
  const libelleCourt = (id: string) => libelleCat(id).split(/\s*[&,]\s*/)[0];

  // Convergence par thème pour le groupe courant (seuls les thèmes comparables), triée
  // par ordre alphabétique du libellé.
  const lignes = useMemo(() => {
    if (!courant) return [];
    return Object.entries(resultat.parTheme)
      .map(([theme, parGroupe]) => ({ theme, pct: parGroupe[courant.abrev]?.pct ?? null }))
      .filter((l) => l.pct != null)
      .sort((a, b) => libelleCourt(a.theme).localeCompare(libelleCourt(b.theme), "fr")) as { theme: string; pct: number }[];
  }, [courant, resultat, cats]);

  if (!courant) return null;
  const col = couleur(courant.abrev);
  const aller = (d: number) => setI((v) => (((Math.min(v, n - 1) + d) % n) + n) % n);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Par thème</Text>
        <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>{idx + 1} / {n}</Text>
      </View>

      {/* Carte du groupe courant + flèches */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TouchableOpacity
          onPress={() => aller(-1)}
          disabled={n < 2}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceAlt, opacity: n < 2 ? 0.4 : 1 }}
        >
          <Feather name="chevron-left" size={20} color={C.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: "center", backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 16, paddingHorizontal: 12, ...shadowCard }}>
          <HemicyclePicto groupes={partis} activeAbrev={courant.abrev} color={col} size={64} />
          <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>{courant.abrev}</Text>
          <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 1 }]} numberOfLines={2}>
            {libelleParti(courant.abrev)}
          </Text>
          <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>
            {Math.round(courant.pct * 100)}<Text style={[T.body, { fontFamily: F.bold, color: C.textFaint }]}> %</Text>
          </Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>de convergence</Text>
        </View>

        <TouchableOpacity
          onPress={() => aller(1)}
          disabled={n < 2}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceAlt, opacity: n < 2 ? 0.4 : 1 }}
        >
          <Feather name="chevron-right" size={20} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* Points indicateurs */}
      {n > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
          {groupes.map((g, k) => (
            <TouchableOpacity key={g.abrev} onPress={() => setI(k)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
              <View style={{ width: k === idx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: k === idx ? col : C.borderStrong }} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Convergence par thème (barres à la couleur du groupe) */}
      <View style={{ marginTop: 16, gap: 9 }}>
        {lignes.map((l) => (
          <View key={l.theme} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[T.small, { width: 92, color: C.text, fontFamily: F.medium }]} numberOfLines={1}>{libelleCourt(l.theme)}</Text>
            <View style={{ flex: 1, height: 7, borderRadius: 4, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
              <View style={{ height: 7, borderRadius: 4, width: `${Math.round(l.pct * 100)}%`, backgroundColor: col }} />
            </View>
            <Text style={[T.small, tnum, { fontFamily: F.bold, color: C.text, minWidth: 38, textAlign: "right" }]}>{Math.round(l.pct * 100)} %</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
