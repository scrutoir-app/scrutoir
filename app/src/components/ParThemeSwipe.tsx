import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, PanResponder } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard, couleurGroupe } from "../theme";
import { catUI } from "../categoryUI";
import { HemicyclePicto } from "./HemicyclePicto";
import { SEUIL_FIABLE } from "../testProximite/jeProximite";

// Convergence électeur ↔ parti, dite en MOTS + COULEUR de donnée (jamais un parti) : seuils
// ≥ 67 % « Comme toi », 34–66 % « Entre les deux », ≤ 33 % « Pas comme toi ».
const NARRATIFS = ["Pas comme toi", "Entre les deux", "Comme toi"];
const bucket = (pct: number) => (pct >= 0.67 ? 2 : pct >= 0.34 ? 1 : 0);
import type { PartiResume, CategorieRef } from "../types";
import type { ResultatProximite } from "../testProximite/score";
import type { Nav } from "../nav";

/**
 * « Par thème » — UN groupe à la fois, dans l'ordre de proximité décroissante (le plus
 * proche par défaut), navigable par flèches / points. Pour le groupe courant : convergence
 * globale (en tête) + convergence par thème dite en MOTS + couleur de donnée (barre vert /
 * neutre / rouge = la convergence, JAMAIS le parti). Un thème peu couvert ne tombe pas en
 * rouge : état « pas encore de données » distinct + invite à se positionner.
 * Remplace la matrice multi-colonnes (illisible sur mobile). Rien à afficher sans « je ».
 */
export function ParThemeSwipe({
  resultat,
  partis,
  cats,
  nav,
  neufParTheme,
}: {
  resultat: ResultatProximite;
  partis: PartiResume[];
  cats: CategorieRef[];
  nav?: Nav;
  // Nb de questions NON répondues par thème (pour proposer d'approfondir un thème peu couvert).
  neufParTheme?: Record<string, number>;
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

  // Convergence par thème pour le groupe courant, triée par libellé. `fiable` = assez de
  // votes comparés (≥ SEUIL_FIABLE) ET convergence calculable : sinon « pas encore de données »
  // (jamais un rouge trompeur). On garde les thèmes peu couverts S'IL reste des questions à
  // te positionner (`neuf`), pour pouvoir compléter ; on jette les thèmes sans donnée ni action.
  const lignes = useMemo(() => {
    if (!courant) return [];
    return Object.keys(resultat.parTheme)
      .map((theme) => {
        const g = resultat.parTheme[theme]?.[courant.abrev];
        const pct = g?.pct ?? null;
        const comparable = g?.comparable ?? 0;
        const neuf = neufParTheme?.[theme] ?? 0;
        return { theme, pct, comparable, neuf, fiable: pct != null && comparable >= SEUIL_FIABLE };
      })
      .filter((l) => l.fiable || l.neuf > 0)
      .sort((a, b) => libelleCat(a.theme).localeCompare(libelleCat(b.theme), "fr"));
  }, [courant, resultat, cats, neufParTheme]);

  // Couleur de la DONNÉE de convergence (lue sur la palette vivante → suit le thème).
  const convCouleur = (b: number) => [
    { barre: C.contre, texte: C.rejeteFg },     // 0 Pas comme toi (rouge sobre)
    { barre: C.textFaint, texte: C.textMuted }, // 1 Entre les deux (neutre ardoise)
    { barre: C.pour, texte: C.adopteFg },       // 2 Comme toi (vert sobre)
  ][b];

  // Fondu doux à chaque changement de groupe (et à l'apparition) : la carte n'entre plus
  // de façon abrupte. Léger glissement vertical en complément.
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    slide.setValue(6);
    const anim = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [idx]);

  const col = couleurGroupe(couleur(courant?.abrev ?? ""));
  const aller = (d: number) => setI((v) => (((Math.min(v, n - 1) + d) % n) + n) % n);

  // Swipe gauche/droite (en plus des flèches) : on garde la dernière `aller` dans une ref pour
  // que le PanResponder (créé une seule fois) appelle toujours la version à jour.
  const allerRef = useRef(aller);
  allerRef.current = aller;
  const pan = useRef(
    PanResponder.create({
      // Ne capture QUE les glissements franchement horizontaux (laisse le scroll vertical + les taps).
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -40) allerRef.current(1); // glisse vers la gauche → suivant
        else if (g.dx >= 40) allerRef.current(-1); // vers la droite → précédent
      },
    })
  ).current;

  if (!courant) return null;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={[T.callout, { fontFamily: F.extra, color: C.text }]}>Par thème</Text>
        <Text style={[T.small, tnum, { fontFamily: F.semibold, color: C.textMuted }]}>{idx + 1} / {n}</Text>
      </View>

      {/* Carte du groupe courant + flèches — swipe gauche/droite actif sur toute la rangée.
          userSelect:none → un vrai drag souris ne déclenche pas la sélection de texte (sinon
          le navigateur vole le geste) ; touchAction:pan-y → le tactile garde le scroll vertical
          mais laisse le geste horizontal au carrousel. */}
      <View {...pan.panHandlers} style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, { userSelect: "none", touchAction: "pan-y", cursor: "grab" }] as any}>
        <TouchableOpacity
          onPress={() => aller(-1)}
          disabled={n < 2}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceAlt, opacity: n < 2 ? 0.4 : 1 }}
        >
          <Feather name="chevron-left" size={20} color={C.text} />
        </TouchableOpacity>

        <Animated.View style={{ flex: 1, alignItems: "center", backgroundColor: C.surface, borderRadius: RADIUS.md, paddingVertical: 16, paddingHorizontal: 12, opacity: fade, transform: [{ translateY: slide }], ...shadowCard }}>
          <HemicyclePicto groupes={partis} activeAbrev={courant.abrev} color={col} size={64} />
          <Text style={[T.heading, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>{courant.abrev}</Text>
          <Text style={[T.small, { color: C.textMuted, textAlign: "center", marginTop: 1 }]} numberOfLines={2}>
            {libelleParti(courant.abrev)}
          </Text>
          <Text style={[T.title, tnum, { fontFamily: F.extra, color: C.text, marginTop: 8 }]}>
            {Math.round(courant.pct * 100)}<Text style={[T.body, { fontFamily: F.bold, color: C.textFaint }]}> %</Text>
          </Text>
          <Text style={[T.micro, { fontFamily: F.medium, color: C.textFaint }]}>de convergence</Text>
        </Animated.View>

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

      {/* Convergence par thème, dite en MOTS + couleur de donnée. Une carte, des lignes
          alignées sur le composant de thème de référence (tuile-icône · nom · barre · narratifs). */}
      <View style={{ marginTop: 16, backgroundColor: C.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, ...shadowCard }}>
        {lignes.map((l, k) => {
          const dernier = k === lignes.length - 1;
          const b = l.fiable ? bucket(l.pct!) : 1;
          const cc = convCouleur(b);
          return (
            <View key={l.theme} style={{ paddingVertical: 16, ...(dernier ? {} : { borderBottomWidth: 1, borderBottomColor: C.border }) }}>
              {/* Tuile icône de catégorie + nom (jamais tronqué : jusqu'à 2 lignes). */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name={catUI(l.theme).icon as any} size={22} color={C.accent} />
                </View>
                <Text style={[T.body, { flex: 1, fontFamily: F.bold, color: C.text }]} numberOfLines={2}>{libelleCat(l.theme)}</Text>
              </View>

              {l.fiable ? (
                <>
                  {/* Barre d'AFFICHAGE (pas un curseur) remplie à la convergence, couleur = donnée. */}
                  <View style={{ marginTop: 12, height: 8, borderRadius: 4, backgroundColor: C.surfaceSunken, overflow: "hidden" }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${Math.round(l.pct! * 100)}%`, backgroundColor: cc.barre }} />
                  </View>
                  {/* Triplet narratif sur une ligne, l'actif en gras et teinté. */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                    {NARRATIFS.map((o, ni) => (
                      <Text key={o} style={[T.small, { color: ni === b ? cc.texte : C.textFaint, fontFamily: ni === b ? F.bold : F.semibold }]} numberOfLines={1}>{o}</Text>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  {/* Pas encore de données : barre neutre désactivée (pointillé), jamais un rouge. */}
                  <View style={{ marginTop: 12, height: 8, borderRadius: 4, borderWidth: 1, borderStyle: "dashed", borderColor: C.borderStrong, backgroundColor: "transparent" }} />
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                    <Text style={[T.small, { color: C.textMuted, fontFamily: F.semibold }]}>Pas encore de données</Text>
                    {nav && l.neuf > 0 && (
                      <TouchableOpacity onPress={() => nav.push({ name: "test", mode: "affiner", theme: l.theme, themeLibelle: libelleCat(l.theme) })} hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Text style={[T.small, { fontFamily: F.bold, color: C.accent }]}>+{l.neuf} à te positionner</Text>
                        <Feather name="chevron-right" size={15} color={C.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
