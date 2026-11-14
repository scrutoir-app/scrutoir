// Rubrique Présidentielle 2027 : briques visuelles. Verdicts en encre neutre (tokens verdict*),
// couleurs de vote réservées aux barres du groupe, aucun pourcentage, aucun hex en dur.
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F, T, tnum } from "../../theme";
import { useReduceMotion } from "../HeroScrutins";
import type { Comptes, Famille } from "../../presidentielle/types";
import { neutres } from "../../presidentielle/logique";
import { GLYPHE } from "../../presidentielle/libelles";
import { premiereFois } from "../../presidentielle/donnees";

/** Courbe commune de la rubrique (pression, entrées). */
export const COURBE = Easing.bezier(0.23, 1, 0.32, 1);
const natif = Platform.OS !== "web";

/** Retour haptique « sélection » : natif seulement. La PWA (cible v1) n'en a pas (iOS Safari ne
 *  vibre pas) ; expo-haptics n'est volontairement pas installé. À brancher avec les apps natives. */
export function retourSelection(): void {
  /* natif : Haptics.selectionAsync() quand expo-haptics sera ajouté */
}

/**
 * Bouton avec retour de pression : scale 0,97 en 140 ms (cubic-bezier 0.23, 1, 0.32, 1).
 * Réduction des mouvements : pas de scale, l'opacité baisse à la place.
 */
export function Pression({
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  accessibilityHint,
  disabled,
  hitSlop,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link" | "tab";
  accessibilityState?: { selected?: boolean; expanded?: boolean; disabled?: boolean };
  accessibilityHint?: string;
  disabled?: boolean;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}) {
  const rm = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  const aller = (to: number) =>
    Animated.timing(v, { toValue: to, duration: 140, easing: COURBE, useNativeDriver: natif }).start();
  const anim = rm
    ? { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }
    : { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }] };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => aller(1)}
      onPressOut={() => aller(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      accessibilityHint={accessibilityHint}
      aria-selected={accessibilityState?.selected}
      aria-expanded={accessibilityState?.expanded}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * Entrée échelonnée d'une liste : 260 ms par élément, 40 ms d'écart, plafond 200 ms, à la
 * PREMIÈRE ouverture de l'écran seulement (`cle`). Réduction des mouvements : fondu de 200 ms.
 */
export function Entree({ cle, children, style, gap }: { cle: string; children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  const rm = useReduceMotion();
  const [animer] = useState(() => premiereFois(`entree:${cle}`));
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ gap }, style]}>
      {items.map((c, i) => (
        <ElementEntrant key={(c as any).key ?? i} index={i} animer={animer} reduit={rm}>
          {c}
        </ElementEntrant>
      ))}
    </View>
  );
}

function ElementEntrant({ index, animer, reduit, children }: { index: number; animer: boolean; reduit: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(animer ? 0 : 1)).current;
  useEffect(() => {
    if (!animer) return;
    const a = Animated.timing(v, {
      toValue: 1,
      duration: reduit ? 200 : 260,
      delay: reduit ? 0 : Math.min(index * 40, 200),
      easing: reduit ? Easing.linear : COURBE,
      useNativeDriver: natif,
    });
    a.start();
    return () => a.stop();
  }, []);
  const style = reduit
    ? { opacity: v }
    : { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** Pastille de verdict : = encre pleine · ≠ gris moyen · ∅ cercle vide. Décorative (le mot suit). */
export function PastilleVerdict({ famille, taille = 24 }: { famille: Famille; taille?: number }) {
  const fond = famille === "c" ? C.verdictCoherent : famille === "t" ? C.verdictTension : "transparent";
  const encre = famille === "c" ? C.onVerdictCoherent : famille === "t" ? C.onVerdictTension : C.verdictNeutreStroke;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={{
        width: taille,
        height: taille,
        borderRadius: taille / 2,
        backgroundColor: fond,
        borderWidth: famille === "n" ? 1.5 : 0,
        borderColor: C.verdictNeutreStroke,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text style={{ fontFamily: F.extra, fontSize: taille >= 36 ? 18 : 13, lineHeight: taille >= 36 ? 22 : 16, color: encre }}>{GLYPHE[famille]}</Text>
    </View>
  );
}

// --- Anneaux ----------------------------------------------------------------------------------

/** Arc de couronne (rayon extérieur r, épaisseur th) de a0 à a1 (radians, 0 = midi, sens horaire). */
export function arcCouronne(cx: number, cy: number, r: number, th: number, a0: number, a1: number): string {
  if (a1 - a0 < 0.0005) return "";
  if (a1 - a0 > 6.2831) a1 = a0 + 6.283;
  const p = (rr: number, a: number) => `${(cx + rr * Math.sin(a)).toFixed(2)},${(cy - rr * Math.cos(a)).toFixed(2)}`;
  const r0 = r - th;
  const lg = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r, a0)} A${r},${r} 0 ${lg} 1 ${p(r, a1)} L${p(r0, a1)} A${r0},${r0} 0 ${lg} 0 ${p(r0, a0)} Z`;
}

/** Les trois segments (c, t, n) d'un anneau qui fait le tour de son propre total. */
export function segmentsAnneau(cx: number, cy: number, r: number, th: number, k: Comptes, ecart: number): Record<Famille, string> {
  const v: Record<Famille, number> = { c: k.c, t: k.t, n: neutres(k) };
  const tot = v.c + v.t + v.n;
  let a = 0;
  const out = { c: "", t: "", n: "" } as Record<Famille, string>;
  (["c", "t", "n"] as Famille[]).forEach((f) => {
    const a1 = a + 2 * Math.PI * (tot ? v[f] / tot : 0);
    const gap = v[f] === tot ? 0 : ecart;
    out[f] = v[f] ? arcCouronne(cx, cy, r, th, a + gap, a1 - gap) : "";
    a = a1;
  });
  return out;
}

const remplissage = (f: Famille) =>
  f === "c" ? { fill: C.verdictCoherent } : f === "t" ? { fill: C.verdictTension } : { fill: C.surface, stroke: C.verdictNeutreStroke, strokeWidth: 1.4 };

export interface AnneauSpec {
  cle: string;
  comptes: Comptes;
  /** Opacité par famille (filtre actif, anneau choisi ou atténué). */
  opacite: (f: Famille) => number;
}

/**
 * Anneaux concentriques (extérieur → intérieur). Tracé (rotation + fondu, transform et opacité
 * seulement) en 600 ms UNE fois par session ; ensuite affichage direct. `label` : tous les comptes
 * en toutes lettres (le dessin est une image pour les lecteurs d'écran).
 */
export function Anneaux({ taille, anneaux, epaisseur, pas, label, cleSession }: { taille: number; anneaux: AnneauSpec[]; epaisseur: number; pas: number; label: string; cleSession: string }) {
  const rm = useReduceMotion();
  const [animer] = useState(() => premiereFois(`anneaux:${cleSession}`));
  const v = useRef(new Animated.Value(animer ? 0 : 1)).current;
  useEffect(() => {
    if (!animer) return;
    const a = Animated.timing(v, { toValue: 1, duration: rm ? 200 : 600, easing: rm ? Easing.linear : COURBE, useNativeDriver: natif });
    a.start();
    return () => a.stop();
  }, []);
  const c = taille / 2;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} aria-label={label} style={{ width: taille, height: taille }}>
      {anneaux.map((an, i) => {
        const seg = segmentsAnneau(c, c, c - 2 - i * pas, epaisseur, an.comptes, 0.025 + i * 0.005);
        const style = rm
          ? { opacity: v }
          : {
              opacity: v,
              transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${-50 + i * 12}deg`, "0deg"] }) }],
            };
        return (
          <Animated.View key={an.cle} style={[{ position: "absolute", left: 0, top: 0, width: taille, height: taille }, style]} pointerEvents="none">
            <Svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
              {(["c", "t", "n"] as Famille[]).map((f) =>
                seg[f] ? <Path key={f} d={seg[f]} {...remplissage(f)} opacity={an.opacite(f)} /> : null,
              )}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Mini-anneau statique d'un chapitre (32 px), décoratif : les comptes sont écrits à côté. */
export function MiniAnneau({ comptes, opacite, taille = 32 }: { comptes: Comptes; opacite: (f: Famille) => number; taille?: number }) {
  const c = taille / 2;
  const seg = segmentsAnneau(c, c, c - 1, Math.round(taille * 0.19), comptes, 0.04);
  const vide = comptes.c + comptes.t + neutres(comptes) === 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: taille, height: taille }}>
      <Svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`}>
        {vide ? (
          <Path d={arcCouronne(c, c, c - 1, Math.round(taille * 0.19), 0, 2 * Math.PI)} fill="none" stroke={C.borderStrong} strokeWidth={1} />
        ) : (
          (["c", "t", "n"] as Famille[]).map((f) => (seg[f] ? <Path key={f} d={seg[f]} {...remplissage(f)} opacity={opacite(f)} /> : null))
        )}
      </Svg>
    </View>
  );
}

// --- Textes -----------------------------------------------------------------------------------

/** Sur-titre en capitales (11 px, gras, espacé). */
export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[T.micro, { fontFamily: F.bold, letterSpacing: 0.44, textTransform: "uppercase", color: C.textMuted }, style]}>{children}</Text>;
}

/** Comptes « = 12  ≠ 4  ∅ 30 » en chiffres tabulaires. */
export function LigneComptes({ texte, style }: { texte: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[T.micro, tnum, { fontFamily: F.bold, color: C.textMuted }, style]}>{texte}</Text>;
}

/** Zone d'annonce polie pour lecteurs d'écran (après un filtrage). Invisible à l'œil. */
export function AnnoncePolie({ texte }: { texte: string }) {
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    if (natif && texte) AccessibilityInfo.announceForAccessibility(texte);
  }, [texte]);
  return (
    <Text
      accessibilityLiveRegion="polite"
      aria-live="polite"
      style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0, left: 0, top: 0 }}
    >
      {texte}
    </Text>
  );
}

/** Carte blanche de la rubrique (rayon 16, sans ombre, comme la maquette). */
export function Bloc({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ backgroundColor: C.surface, borderRadius: 16 }, style]}>{children}</View>;
}
