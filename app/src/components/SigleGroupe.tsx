import React, { useEffect, useId, useRef, useState } from "react";
import {
  Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle,
} from "react-native";
import { C, F, T, RADIUS, S, HIT_SLOP_MIN, shadowCard } from "../theme";
import { useBulleSigle, useGroupesConnus } from "../hooks/useSigleGroupe";
import {
  basculerBulle, fermerBulle, garderBulle, placerBulle, quitterSurvol, survolerSigle, type Bulle,
} from "../sigleGroupe";
import type { Nav, Route } from "../nav";

// Sigle d'un groupe qui se déplie en son nom complet (maquette validée le 11/11/2026).
//  · Au repos : rien ne change (même texte, même style, même place).
//  · Toucher (ou survol à la souris) : une bulle encre sous le sigle, « EPR · Ensemble pour la
//    République » + « Voir la fiche du groupe » (sauf sur cette fiche). Une seule à la fois ; elle
//    se ferme au toucher ailleurs, au défilement, à Échap ou après 4 s (sigleGroupe.ts).
//  · Dans une ligne déjà cliquable : le sigle ouvre la bulle, le reste de la ligne garde son action.
//  · Nom tiré de partis.json. Sigle absent des données (groupe du Sénat…) : affiché seul, sans bulle.
// La bulle est dessinée par <BulleSigleHote>, monté une fois à la racine de l'app : dans la ligne,
// elle serait coupée par les cartes (overflow: hidden).

export function SigleGroupe({
  abrev, texte, style, numberOfLines, conteneur, children,
}: {
  abrev: string | null | undefined;
  /** Texte affiché, par défaut le sigle (ex. « Sans groupe » quand il n'y en a pas). */
  texte?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Style de la zone tactile : largeur de colonne, alignement dans une colonne, pastille… */
  conteneur?: StyleProp<ViewStyle>;
  /** Contenu sur mesure (pastille avec son point de couleur) à la place du texte seul. */
  children?: React.ReactNode;
}) {
  const groupes = useGroupesConnus();
  const g = abrev ? groupes?.get(abrev) ?? null : null;
  const cle = useId();
  const ouvert = useBulleSigle()?.cle === cle;
  const ref = useRef<View>(null);
  const [taille, setTaille] = useState<{ w: number; h: number } | null>(null);

  // Web : le nom complet aussi en infobulle du navigateur (attribut title).
  useEffect(() => {
    if (Platform.OS !== "web" || !g) return;
    (ref.current as unknown as { setAttribute?: (k: string, v: string) => void } | null)?.setAttribute?.("title", g.libelle);
  }, [g]);

  const contenu = children ?? <Text style={style} numberOfLines={numberOfLines}>{texte ?? abrev ?? "—"}</Text>;
  if (!g) return conteneur ? <View style={conteneur}>{contenu}</View> : <>{contenu}</>;

  const bulle = (ancre: Bulle["ancre"]): Bulle => ({ cle, groupe: g, ancre, noeud: ref.current });
  const mesurer = (suite: (b: Bulle) => void) =>
    ref.current?.measureInWindow((x, y, w, h) => suite(bulle({ x, y, w, h })));

  // Zone de toucher d'au moins 44 px : hitSlop (natif) et une zone transparente qui déborde du
  // sigle (web, où hitSlop n'existe pas). Sans effet sur la mise en page.
  const v = taille ? Math.max(0, Math.ceil((HIT_SLOP_MIN - taille.h) / 2)) : 0;
  const h = taille ? Math.max(0, Math.ceil((HIT_SLOP_MIN - taille.w) / 2)) : 0;

  return (
    <Pressable
      ref={ref}
      onPress={(e: GestureResponderEvent) => {
        e?.stopPropagation?.(); // la ligne autour (fiche du groupe, du député…) ne réagit pas
        mesurer(basculerBulle);
      }}
      onHoverIn={() => mesurer(survolerSigle)}
      onHoverOut={() => quitterSurvol()}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (!taille || taille.w !== width || taille.h !== height) setTaille({ w: width, h: height });
      }}
      hitSlop={{ top: v, bottom: v, left: h, right: h }}
      accessibilityRole="button"
      accessibilityLabel={g.libelle}
      accessibilityHint="Affiche le nom complet du groupe"
      accessibilityState={{ expanded: ouvert }}
      style={[{ flexShrink: 1, minWidth: 0 }, conteneur]}
    >
      {Platform.OS === "web" && (v > 0 || h > 0) && (
        <View pointerEvents="auto" style={{ position: "absolute", top: -v, bottom: -v, left: -h, right: -h }} />
      )}
      {contenu}
    </Pressable>
  );
}

/** La bulle du sigle ouvert, dessinée au-dessus de tout l'écran. Monté une fois dans App. */
export function BulleSigleHote({ nav, route }: { nav: Nav; route: Route }) {
  const b = useBulleSigle();
  const { width, height } = useWindowDimensions();
  const refBulle = useRef<View>(null);

  // Changement d'écran : la bulle se ferme.
  useEffect(() => {
    fermerBulle();
  }, [route]);

  // Web : toucher ailleurs, défiler, redimensionner ou Échap ferment la bulle. Toucher le sigle
  // lui-même est laissé à son onPress (qui la referme), toucher la bulle ne la ferme pas.
  useEffect(() => {
    if (!b || Platform.OS !== "web" || typeof document === "undefined") return;
    const dedans = (n: unknown, t: Node) => !!(n as { contains?: (x: Node) => boolean } | null)?.contains?.(t);
    const toucher = (e: Event) => {
      const t = e.target as Node | null;
      if (t && (dedans(refBulle.current, t) || dedans(b.noeud, t))) return;
      fermerBulle();
    };
    const fermer = () => fermerBulle();
    const clavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermerBulle();
    };
    document.addEventListener("pointerdown", toucher, true);
    document.addEventListener("scroll", fermer, true);
    window.addEventListener("resize", fermer);
    document.addEventListener("keydown", clavier);
    return () => {
      document.removeEventListener("pointerdown", toucher, true);
      document.removeEventListener("scroll", fermer, true);
      window.removeEventListener("resize", fermer);
      document.removeEventListener("keydown", clavier);
    };
  }, [b]);

  if (!b) return null;
  const p = placerBulle(b.ancre, { w: width, h: height });
  const surSaFiche = route.name === "parti" && route.uid === b.groupe.uid;
  const cote = p.cote === "gauche" ? { left: p.bord } : { right: p.bord };
  const vertical = p.dessous ? { top: p.vertical } : { bottom: p.vertical };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Natif : pas d'écoute globale, un fond transparent capte le toucher ailleurs. */}
      {Platform.OS !== "web" && <Pressable style={StyleSheet.absoluteFill} onPress={fermerBulle} accessible={false} />}
      <Pressable
        ref={refBulle}
        focusable={false}
        onHoverIn={garderBulle}
        onHoverOut={() => quitterSurvol()}
        accessibilityLiveRegion="polite"
        style={{
          position: "absolute", ...cote, ...vertical, maxWidth: p.largeurMax,
          backgroundColor: C.text, borderRadius: RADIUS.sm, paddingHorizontal: S.s12, paddingVertical: S.s10, ...shadowCard,
        }}
      >
        <View
          style={{
            position: "absolute", width: 10, height: 10, backgroundColor: C.text, transform: [{ rotate: "45deg" }],
            ...(p.dessous ? { top: -5 } : { bottom: -5 }),
            ...(p.cote === "gauche" ? { left: p.pointe - 5 } : { right: p.pointe - 5 }),
          }}
        />
        <Text style={[T.small, { fontFamily: F.semibold, color: C.bg }]}>
          <Text style={{ fontFamily: F.extra }}>{b.groupe.abrev}</Text> · {b.groupe.libelle}
        </Text>
        {!surSaFiche && (
          <Pressable
            onPress={() => {
              fermerBulle();
              nav.push({ name: "parti", uid: b.groupe.uid });
            }}
            accessibilityRole="link"
            accessibilityLabel={`Voir la fiche du groupe ${b.groupe.libelle}`}
            style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center", marginTop: 2 }}
          >
            <Text style={[T.small, { fontFamily: F.bold, color: C.bg, opacity: 0.8 }]}>Voir la fiche du groupe ›</Text>
          </Pressable>
        )}
      </Pressable>
    </View>
  );
}
