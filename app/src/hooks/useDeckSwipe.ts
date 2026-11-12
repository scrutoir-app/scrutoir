import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder } from "react-native";
import { MOTION } from "../theme";
import { decisionGeste, directionGlisse } from "../testProximite/carte";
import type { Reponse } from "../testProximite/score";

/**
 * GESTE COMMUN des paquets de cartes : test de proximité (`TestScreen`) et députés par affinité
 * (`TrouverDeputeScreen`). Animated + PanResponder du cœur RN, aucune dépendance (règle zéro
 * coût). Rendu de référence : maquette « Le test au doigt, avant et après », côté « Retouché ».
 *
 * - Décision au lâcher : distance OU vitesse (`decisionGeste`, logique pure testée).
 * - Envol : 220 ms, départ rapide (`Easing.out(cubic)`), la carte garde sa trajectoire.
 * - Carte du dessous : elle suit le doigt (interpolations de `pan`, sans état React) et se trouve
 *   déjà en place quand elle devient la carte du dessus ; la nouvelle arrive en fondu.
 * - Annuler : la carte revient du côté où elle est partie (`revenir`).
 * - Réduire les animations : pas d'envol, pas de retour animé, carte du dessous fixe.
 *
 * Les écrans gardent leur vocabulaire (pour / contre / sans avis, suivi / passe) et le
 * traduisent en directions. Ils passent `cle`, l'identité de la carte du dessus : c'est quand
 * elle change que le hook remet la carte à zéro (ou lance le retour d'une annulation), juste
 * après le rendu et avant l'affichage, pour qu'aucune image intermédiaire ne se voie.
 */

export type Direction = "droite" | "gauche" | "haut";

/** Style de repos de la carte du dessous (celle du dessus est à 1 / 0 / 1). */
export type StyleRepos = { scale: number; translateY: number; opacity: number };

export type DeckSwipeOptions = {
  /** Identité de la carte du dessus (undefined : plus de carte). */
  cle: string | number | undefined;
  /** Directions possibles : le test les trois, le deck députés droite et gauche. */
  directions: readonly Direction[];
  largeur: number;
  hauteur: number;
  seuil: number;
  reduceMotion: boolean;
  /** Fin de l'envol (ou tout de suite si les animations sont réduites) : l'écran enregistre. */
  onDecision: (d: Direction) => void;
  /** Rotation à une largeur d'écran, en degrés. */
  rotationMax: number;
  dessous: StyleRepos;
  /** Déplacement (px) au-delà duquel le paquet prend le geste. */
  seuilCapture: number;
};

const DIRECTION_DE: Record<Reponse, Direction> = { pour: "droite", contre: "gauche", sans_avis: "haut" };
const ENVOL = 220; // ms
const FONDU = 200; // ms : apparition de la nouvelle carte du dessous
const SORTIE = 1.35; // × largeur : la carte quitte l'écran
const VITESSE_FRAICHE = 100; // ms : doigt immobile plus longtemps avant de lâcher → vitesse nulle
const COURBE = Easing.out(Easing.cubic);

/** Position hors champ d'une direction, en gardant l'autre axe tel qu'il est. */
function horsChamp(d: Direction, depuis: { x: number; y: number }, largeur: number, hauteur: number) {
  if (d === "droite") return { x: largeur * SORTIE, y: depuis.y };
  if (d === "gauche") return { x: -largeur * SORTIE, y: depuis.y };
  return { x: depuis.x, y: -hauteur };
}

type Attente = { type: "decision" } | { type: "retour"; d: Direction; apres?: () => void };

export function useDeckSwipe(o: DeckSwipeOptions) {
  const opts = useRef(o);
  opts.current = o;

  const pan = useRef(new Animated.ValueXY()).current;
  const fondu = useRef(new Animated.Value(1)).current;
  // Étiquettes masquées pendant un retour : une carte qu'on annule ne montre ni Pour ni Suivre.
  const etiquettes = useRef(new Animated.Value(1)).current;
  const busy = useRef(false); // verrou : ignore un 2e choix tant que la carte s'envole ou revient
  // Fin du dernier glissé : un glissé parti d'un lien ne doit pas l'ouvrir au lâcher (le
  // navigateur émet quand même un clic sur le lien).
  const finGlisse = useRef(0);
  const attente = useRef<Attente | null>(null);
  const [direction, setDirection] = useState<Direction | null>(null);
  const dirRef = useRef<Direction | null>(null);

  // Fonctions créées une fois : elles ne lisent que des refs (le PanResponder et le clavier
  // les gardent).
  const moteur = useRef<{
    majDirection: (d: Direction | null) => void;
    choisir: (d: Direction) => void;
    revenir: (d: Direction, apres?: () => void) => void;
    glisseRecent: () => boolean;
  } | null>(null);
  if (!moteur.current) {
    const majDirection = (d: Direction | null) => {
      if (d === dirRef.current) return;
      dirRef.current = d;
      setDirection(d);
    };
    const decider = (d: Direction) => {
      attente.current = { type: "decision" };
      majDirection(null);
      opts.current.onDecision(d);
    };
    const choisir = (d: Direction) => {
      const op = opts.current;
      if (busy.current || !op.directions.includes(d)) return;
      busy.current = true;
      majDirection(d);
      if (op.reduceMotion) return decider(d);
      // Départ de là où est la carte (lâcher, ou repos pour un bouton / le clavier).
      pan.stopAnimation((v) => {
        Animated.timing(pan, { toValue: horsChamp(d, v, op.largeur, op.hauteur), duration: ENVOL, easing: COURBE, useNativeDriver: false })
          .start(({ finished }) => { if (finished) decider(d); });
      });
    };
    const revenir = (d: Direction, apres?: () => void) => {
      if (opts.current.reduceMotion) { apres?.(); return; }
      busy.current = true;
      attente.current = { type: "retour", d, apres };
    };
    moteur.current = { majDirection, choisir, revenir, glisseRecent: () => Date.now() - finGlisse.current < 400 };
  }
  const { majDirection, choisir, revenir, glisseRecent } = moteur.current;

  const responder = useRef(
    PanResponder.create({
      // Capture au-delà de quelques pixels : un glissé qui part d'un lien reste un geste, un
      // simple appui sur le lien l'ouvre.
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        const s = opts.current.seuilCapture;
        return !busy.current && (Math.abs(g.dx) > s || Math.abs(g.dy) > s);
      },
      onPanResponderMove: (_e, g) => {
        finGlisse.current = Date.now();
        pan.setValue({ x: g.dx, y: g.dy });
        const op = opts.current;
        // Sans « haut » (deck députés), seul l'axe horizontal compte.
        const r = directionGlisse(g.dx, op.directions.includes("haut") ? g.dy : 0);
        const d = r ? DIRECTION_DE[r] : null;
        majDirection(d && op.directions.includes(d) ? d : null);
      },
      onPanResponderRelease: (_e, g) => {
        const op = opts.current;
        const vertical = op.directions.includes("haut");
        // Vitesse du dernier mouvement, sauf si le doigt s'est arrêté avant de lâcher.
        const frais = Date.now() - finGlisse.current < VITESSE_FRAICHE;
        finGlisse.current = Date.now();
        const r = decisionGeste(g.dx, vertical ? g.dy : 0, op.seuil, frais ? g.vx : 0, frais && vertical ? g.vy : 0);
        const d = r ? DIRECTION_DE[r] : null;
        if (d && op.directions.includes(d)) return choisir(d);
        majDirection(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
      onPanResponderTerminate: () => {
        majDirection(null);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, bounciness: 6 }).start();
      },
    })
  ).current;

  // Nouvelle carte du dessus : remise à zéro (+ fondu de la nouvelle carte du dessous après une
  // réponse), ou retour de la carte annulée depuis le côté où elle était partie.
  useLayoutEffect(() => {
    const a = attente.current;
    attente.current = null;
    const op = opts.current;
    if (a?.type === "retour" && !op.reduceMotion) {
      fondu.stopAnimation();
      fondu.setValue(1);
      etiquettes.setValue(0);
      pan.setValue(horsChamp(a.d, { x: 0, y: 0 }, op.largeur, op.hauteur));
      Animated.timing(pan, { toValue: { x: 0, y: 0 }, duration: MOTION.base, easing: COURBE, useNativeDriver: false }).start(() => {
        etiquettes.setValue(1);
        busy.current = false;
        a.apres?.();
      });
      return;
    }
    pan.setValue({ x: 0, y: 0 });
    etiquettes.setValue(1);
    busy.current = false;
    majDirection(null);
    if (a?.type === "decision" && !op.reduceMotion) {
      fondu.setValue(0);
      Animated.timing(fondu, { toValue: 1, duration: FONDU, easing: COURBE, useNativeDriver: false }).start();
    }
  }, [o.cle]);

  const vertical = o.directions.includes("haut");
  const { seuil, largeur, rotationMax, reduceMotion } = o;
  const { scale, translateY, opacity } = o.dessous;
  const anim = useMemo(() => {
    const rotate = pan.x.interpolate({ inputRange: [-largeur, 0, largeur], outputRange: [`-${rotationMax}deg`, "0deg", `${rotationMax}deg`] });
    const opacites: Record<Direction, Animated.AnimatedInterpolation<number>> = {
      droite: Animated.multiply(pan.x.interpolate({ inputRange: [0, seuil], outputRange: [0, 1], extrapolate: "clamp" }), etiquettes),
      gauche: Animated.multiply(pan.x.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" }), etiquettes),
      haut: Animated.multiply(pan.y.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" }), etiquettes),
    };
    if (reduceMotion) {
      return { rotate, opacites, styleDessous: { transform: [{ scale }, { translateY }], opacity } };
    }
    // Progression p = clamp(max(|x|, -y) / seuil, 0, 1) (|x| seul sans « haut »).
    // max(a, b) = (a + b + |a - b|) / 2, faute de max dans Animated.
    const px = pan.x.interpolate({ inputRange: [-seuil, 0, seuil], outputRange: [1, 0, 1], extrapolate: "clamp" });
    let p: Animated.AnimatedInterpolation<number> = px;
    if (vertical) {
      const py = pan.y.interpolate({ inputRange: [-seuil, 0], outputRange: [1, 0], extrapolate: "clamp" });
      const ecart = Animated.subtract<number>(px, py).interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, 1] });
      p = Animated.add<number>(Animated.add(px, py), ecart).interpolate({ inputRange: [0, 2], outputRange: [0, 1] });
    }
    const styleDessous = {
      transform: [
        { scale: p.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
        { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [translateY, 0] }) },
      ],
      opacity: Animated.multiply(p.interpolate({ inputRange: [0, 1], outputRange: [opacity, 1] }), fondu),
    };
    return { rotate, opacites, styleDessous };
  }, [seuil, largeur, rotationMax, reduceMotion, vertical, scale, translateY, opacity]);

  return {
    pan,
    rotate: anim.rotate,
    panHandlers: responder.panHandlers,
    styleDessous: anim.styleDessous,
    direction,
    opacites: anim.opacites,
    choisir,
    revenir,
    busy,
    glisseRecent,
  };
}
