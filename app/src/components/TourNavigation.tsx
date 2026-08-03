import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Animated, Easing, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";
import { useReduceMotion } from "./HeroScrutins";

export type TourKind = "onglet" | "zone";
/** Un pas de la visite : une phrase, et un nœud RÉEL à mesurer (onglet OU zone de l'accueil). */
export interface TourStep { label: string; phrase: string; kind: TourKind; node: any; preferAbove?: boolean }
type Rect = { x: number; y: number; w: number; h: number };

const SCRIM = "rgba(8,10,14,0.66)"; // voile établi de la visite (couleur historique conservée)
const RING = "#FFFFFF"; // anneau blanc établi de la visite (couleur historique conservée)

/**
 * Visite guidée par-dessus l'accueil (aucun routing ne change). Deux sortes de pas :
 *  • « onglet » — voile du haut jusqu'au sommet de la barre d'onglets (qui reste visible
 *    dessous), anneau blanc pulsant autour de l'onglet, bulle au-dessus de la barre.
 *  • « zone » — voile PERCÉ autour de la zone mesurée (4 rectangles sombres : haut/bas/
 *    gauche/droite), fin liseré d'accent autour du trou, bulle dessous s'il y a la place,
 *    sinon dessus. La zone est d'abord amenée à l'écran (l'accueil est une ScrollView).
 * La POSITION vient toujours de `measureInWindow` sur les vrais nœuds → juste même si la
 * mise en page évolue. Les pas dont la cible n'est pas montée (rect vide) sont ÉCARTÉS :
 * aucun pas ne pointe dans le vide. Accessibilité : Échap ferme, focus initial sur
 * « Suivant », le voile absorbe les touches (rien n'est cliquable pendant la visite).
 */
export function TourNavigation({ steps, onClose, note }: { steps: TourStep[]; onClose: () => void; note?: string }) {
  const [rects, setRects] = useState<Rect[]>([]); // aligné sur `steps` (0/0/0/0 si non monté)
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [bubbleH, setBubbleH] = useState(0);
  const [i, setI] = useState(0); // index dans les pas VISIBLES
  const pulse = useRef(new Animated.Value(0)).current;
  const suivantRef = useRef<any>(null);
  const reduce = useReduceMotion();

  // Mesure un nœud en coordonnées fenêtre (web ET natif), best-effort.
  const mesurerNode = (n: any): Promise<Rect> =>
    new Promise((resolve) => {
      if (n && typeof n.measureInWindow === "function") n.measureInWindow((x: number, y: number, w: number, h: number) => resolve({ x, y, w, h }));
      else if (n && typeof n.getBoundingClientRect === "function") { const r = n.getBoundingClientRect(); resolve({ x: r.left, y: r.top, w: r.width, h: r.height }); }
      else resolve({ x: 0, y: 0, w: 0, h: 0 });
    });

  // Mesure TOUS les pas (sans défiler) → sert au filtrage (w > 0) et à la barre d'onglets.
  const mesurerToutes = async () => {
    if (typeof window === "undefined" && Platform.OS === "web") return;
    const rs = await Promise.all(steps.map((s) => mesurerNode(s.node)));
    setRects(rs);
    if (typeof window !== "undefined") setVp({ w: window.innerWidth, h: window.innerHeight });
  };

  useEffect(() => {
    mesurerToutes();
    const onResize = () => mesurerToutes();
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);
    return () => { if (typeof window !== "undefined") window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Échap ferme ; focus initial sur « Suivant » à chaque pas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    const t = setTimeout(() => suivantRef.current?.focus?.(), 90);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose, i]);

  // Anneau pulsant (coupé si « animations réduites »).
  useEffect(() => {
    if (reduce) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.in(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);

  // Pas VISIBLES = ceux dont la cible est réellement montée et mesurée.
  const visibles = steps.map((s, k) => ({ s, k, rect: rects[k] })).filter((e) => e.rect && e.rect.w > 0);
  const N = visibles.length;
  const courant = visibles[Math.min(i, Math.max(0, N - 1))];
  const dernier = i >= N - 1;
  const suivant = () => { if (dernier) onClose(); else setI((s) => Math.min(s + 1, N - 1)); };

  // Amène la zone du pas courant à l'écran puis re-mesure (placement juste sous la ligne de
  // flottaison). Les onglets sont hors ScrollView (position stable) → pas de défilement.
  const [activeRect, setActiveRect] = useState<Rect | null>(null);
  useEffect(() => {
    let alive = true;
    // On NE remet PAS bubbleH à 0 entre les pas : la bulle est la même View réutilisée, un
    // simple changement d'opacité ne redéclenche pas onLayout → elle resterait invisible. On
    // garde la dernière hauteur (les bulles ont des hauteurs voisines) ; onLayout la corrige
    // si elle change vraiment. Seul le tout 1er rendu part de 0 (mesuré aussitôt).
    const node = courant?.s.node;
    if (!node) { setActiveRect(null); return; }
    const finir = () => { mesurerNode(node).then((r) => { if (alive) setActiveRect(r); }); };
    if (courant.s.kind === "zone" && node && typeof node.scrollIntoView === "function") {
      // Défilement MINIMAL (block:"nearest") : si la zone est déjà à l'écran, on ne bouge
      // pas — d'un pas au suivant le contenu reste en place et seule la bulle se déplace. Le
      // recentrage systématique (block:"center") faisait « sauter » la page (ex. 2→3 : le héro
      // remontait alors que le DUO était déjà visible), et rapprochait la bulle des CTA de la
      // page (« Reprendre » du héro ≈ « Suivant »), d'où la confusion.
      // On ne défile QUE si la zone n'est pas déjà entièrement à l'écran (le placement
      // dessus/dessous de la bulle est ensuite décidé au rendu selon la place réelle).
      const need = (() => { const r = node.getBoundingClientRect?.(); if (!r) return true; const h = typeof window !== "undefined" ? window.innerHeight : 0; return r.top < 8 || r.bottom > h - 8; })();
      if (need) { try { node.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior }); } catch { node.scrollIntoView(); } }
      setTimeout(finir, need ? 60 : 0); // laisse le défilement se poser avant de re-mesurer
    } else finir();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, N, rects.length]);

  // Tant que rien n'est mesuré : voile plein (évite un flash), sortie clavier déjà active.
  if (!N || !activeRect || !activeRect.w) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: SCRIM }} />
      </Modal>
    );
  }

  const rect = activeRect;
  const onglet = courant.s.kind === "onglet";
  const bw = Math.min(vp.w - 32, 300);

  // --- Rendu commun de la bulle (contenu identique onglet/zone) ---
  const bulleContenu = (
    <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
      {i === 0 && note ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.accentSoft, borderRadius: RADIUS.sm, padding: 9, marginBottom: 11 }}>
          <Feather name="info" size={15} color={C.accent} style={{ marginTop: 1 }} />
          <Text style={[T.small, { flex: 1, color: C.text, fontFamily: F.semibold }]}>{note}</Text>
        </View>
      ) : null}
      <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 5 }]}>{courant.s.label}</Text>
      <Text style={[T.small, { color: C.text, fontFamily: F.medium }]}>{courant.s.phrase}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Passer la visite">
          <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Passer</Text>
        </TouchableOpacity>
        <Text style={[T.micro, tnum, { color: C.textFaint }]}>{i + 1} sur {N}</Text>
        <TouchableOpacity ref={suivantRef} onPress={suivant} accessibilityRole="button" accessibilityLabel={dernier ? "Terminer la visite" : "Étape suivante"} style={{ backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={[T.small, { fontFamily: F.bold, color: C.onAccent }]}>{dernier ? "Terminer" : "Suivant"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // --- Pas ONGLET : voile jusqu'au sommet de la barre, anneau pulsant, bulle au-dessus ---
  if (onglet) {
    const barTop = Math.min(...visibles.filter((e) => e.s.kind === "onglet").map((e) => e.rect.y));
    const cx = rect.x + rect.w / 2;
    const ringD = Math.max(rect.h + 12, 58);
    const ringY = rect.y + rect.h * 0.42;
    const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
    const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.4] });
    const bLeft = Math.max(16, Math.min(cx - bw / 2, vp.w - 16 - bw));
    const arrowX = Math.max(16, Math.min(cx - bLeft, bw - 16));
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1 }} accessibilityViewIsModal>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, height: barTop, backgroundColor: SCRIM }} />
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: cx - ringD / 2, top: ringY - ringD / 2, width: ringD, height: ringD, borderRadius: ringD / 2, borderWidth: 2.5, borderColor: RING, opacity: ringOp, transform: [{ scale: ringScale }] }} />
          <View style={{ position: "absolute", left: bLeft, width: bw, bottom: vp.h - barTop + 14 }}>
            {bulleContenu}
            <View style={{ position: "absolute", bottom: -7, left: arrowX - 7, width: 14, height: 14, backgroundColor: C.surface, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border, transform: [{ rotate: "45deg" }] }} />
          </View>
        </View>
      </Modal>
    );
  }

  // --- Pas ZONE : voile percé (4 rectangles) + liseré, bulle dessous sinon dessus ---
  const pad = 8;
  const hx = Math.max(0, rect.x - pad), hy = Math.max(0, rect.y - pad);
  const hw = rect.w + pad * 2, hh = rect.h + pad * 2;
  const cx = rect.x + rect.w / 2;
  // Placement de la bulle : par défaut dessous si elle tient, sinon dessus. Un pas peut
  // DEMANDER le dessus (`preferAbove`, ex. le héro dont le CTA « Reprendre » ne doit pas être
  // confondu avec « Suivant ») → on met dessus tant qu'il y a la place, repli dessous sinon.
  const canBelow = hy + hh + bubbleH + 14 <= vp.h;
  const canAbove = hy - bubbleH - 12 >= 12;
  const dessous = courant.s.preferAbove ? !canAbove : canBelow;
  const bTop = dessous ? hy + hh + 12 : Math.max(12, hy - bubbleH - 12);
  const bLeft = Math.max(16, Math.min(cx - bw / 2, vp.w - 16 - bw));
  const arrowX = Math.max(16, Math.min(cx - bLeft, bw - 16));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        {/* Voile percé : haut / bas / gauche / droite du trou (coordonnées fenêtre). */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, height: hy, backgroundColor: SCRIM }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: hy + hh, right: 0, bottom: 0, backgroundColor: SCRIM }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: hy, width: hx, height: hh, backgroundColor: SCRIM }} />
        <View pointerEvents="none" style={{ position: "absolute", left: hx + hw, top: hy, right: 0, height: hh, backgroundColor: SCRIM }} />
        {/* Liseré d'accent autour du trou (token, pas de couleur en dur). */}
        <View pointerEvents="none" style={{ position: "absolute", left: hx, top: hy, width: hw, height: hh, borderRadius: RADIUS.md, borderWidth: 2, borderColor: C.accent }} />
        {/* Bulle (mesurée pour décider dessus/dessous) + flèche. */}
        <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h && Math.abs(h - bubbleH) > 1) setBubbleH(h); }} style={{ position: "absolute", left: bLeft, width: bw, top: bTop, opacity: bubbleH ? 1 : 0 }}>
          {bulleContenu}
          <View style={{ position: "absolute", left: arrowX - 7, width: 14, height: 14, backgroundColor: C.surface, transform: [{ rotate: "45deg" }], ...(dessous
            ? { top: -7, borderLeftWidth: 1, borderTopWidth: 1 }
            : { bottom: -7, borderRightWidth: 1, borderBottomWidth: 1 }), borderColor: C.border }} />
        </View>
      </View>
    </Modal>
  );
}
