import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Animated, Easing, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { C, F, T, tnum, RADIUS, shadowCard } from "../theme";

export interface TourItem { label: string; phrase: string }
type Rect = { x: number; y: number; w: number; h: number };

/**
 * Tour guidé de la barre de navigation, par-dessus la page de résultat (aucun routing ne
 * change). Voile sombre sur la page SAUF la barre d'onglets, qui reste pleinement visible
 * dessous. Un anneau pulsant entoure un onglet à la fois, une bulle au-dessus en explique
 * la fonction. La POSITION est mesurée sur les vrais nœuds du menu (`measureInWindow`) →
 * juste même si le menu évolue. Accessibilité : Échap ferme, focus initial sur « Suivant »,
 * le voile absorbe les touches (la barre n'est pas cliquable pendant le tour).
 */
export function TourNavigation({ items, tabNodes, onClose, note }: { items: TourItem[]; tabNodes: any[]; onClose: () => void; note?: string }) {
  const [step, setStep] = useState(0);
  const [rects, setRects] = useState<Rect[]>([]);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const pulse = useRef(new Animated.Value(0)).current;
  const suivantRef = useRef<any>(null);

  // Mesure réelle des onglets (coordonnées viewport, comme la Modal plein écran).
  const mesurer = () => {
    if (typeof window === "undefined") return;
    const nodes = tabNodes;
    const rs: Rect[] = new Array(nodes.length).fill(null).map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
    let done = 0;
    const fin = () => { if (++done === nodes.length) { setRects([...rs]); setVp({ w: window.innerWidth, h: window.innerHeight }); } };
    nodes.forEach((n, i) => {
      if (n && typeof n.measureInWindow === "function") n.measureInWindow((x: number, y: number, w: number, h: number) => { rs[i] = { x, y, w, h }; fin(); });
      else if (n && typeof n.getBoundingClientRect === "function") { const r = n.getBoundingClientRect(); rs[i] = { x: r.left, y: r.top, w: r.width, h: r.height }; fin(); }
      else fin();
    });
  };

  useEffect(() => {
    mesurer();
    const onResize = () => mesurer();
    if (typeof window !== "undefined") window.addEventListener("resize", onResize);
    return () => { if (typeof window !== "undefined") window.removeEventListener("resize", onResize); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Échap ferme ; focus initial sur « Suivant ».
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (typeof window !== "undefined") window.addEventListener("keydown", onKey);
    const t = setTimeout(() => suivantRef.current?.focus?.(), 90);
    return () => { if (typeof window !== "undefined") window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose, step]);

  // Anneau pulsant.
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.in(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const N = items.length;
  const rect = rects[step];
  const dernier = step === N - 1;
  const suivant = () => { if (dernier) onClose(); else setStep((s) => Math.min(s + 1, N - 1)); };
  // Sommet de la barre = onglet le plus haut → le voile s'arrête là, la bulle se pose dessus.
  const barTop = rects.length ? Math.min(...rects.filter((r) => r.w > 0).map((r) => r.y)) : vp.h;

  // Tant que rien n'est mesuré : voile plein (évite un flash) + sortie clavier déjà active.
  if (!rect || !rect.w) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(8,10,14,0.66)" }} />
      </Modal>
    );
  }

  const cx = rect.x + rect.w / 2;
  const ringD = Math.max(rect.h + 12, 58);
  const ringY = rect.y + rect.h * 0.42; // centré sur l'icône (haut de l'onglet)
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 0.4] });

  const bw = Math.min(vp.w - 32, 300);
  const bLeft = Math.max(16, Math.min(cx - bw / 2, vp.w - 16 - bw));
  const arrowX = Math.max(16, Math.min(cx - bLeft, bw - 16));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Base plein écran : capte toutes les touches → aucune nav pendant le tour. */}
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        {/* Voile : du haut au sommet de la barre (la barre reste visible dessous, non voilée). */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, height: barTop, backgroundColor: "rgba(8,10,14,0.66)" }} />

        {/* Anneau pulsant autour de l'onglet courant. */}
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: cx - ringD / 2, top: ringY - ringD / 2, width: ringD, height: ringD, borderRadius: ringD / 2, borderWidth: 2.5, borderColor: "#FFFFFF", opacity: ringOp, transform: [{ scale: ringScale }] }} />

        {/* Bulle, ancrée juste au-dessus de la barre, centrée sur l'onglet. */}
        <View style={{ position: "absolute", left: bLeft, width: bw, bottom: vp.h - barTop + 14 }}>
          <View style={{ backgroundColor: C.surface, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: C.border, ...shadowCard }}>
            {/* Au 1er pas (Accueil), pour un utilisateur SANS suivi : on signifie que l'accueil
                est vide et comment le remplir (le tour ne s'ouvre que dans ce cas). */}
            {step === 0 && note ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: C.accentSoft, borderRadius: RADIUS.sm, padding: 9, marginBottom: 11 }}>
                <Feather name="info" size={15} color={C.accent} style={{ marginTop: 1 }} />
                <Text style={[T.small, { flex: 1, color: C.text, fontFamily: F.semibold }]}>{note}</Text>
              </View>
            ) : null}
            <Text style={[T.micro, { fontFamily: F.bold, color: C.textFaint, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 5 }]}>{items[step].label}</Text>
            <Text style={[T.small, { color: C.text, fontFamily: F.medium }]}>{items[step].phrase}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Passer le tour">
                <Text style={[T.small, { fontFamily: F.bold, color: C.textMuted }]}>Passer</Text>
              </TouchableOpacity>
              <Text style={[T.micro, tnum, { color: C.textFaint }]}>{step + 1} sur {N}</Text>
              <TouchableOpacity ref={suivantRef} onPress={suivant} accessibilityRole="button" accessibilityLabel={dernier ? "Terminer le tour" : "Onglet suivant"} style={{ backgroundColor: C.accent, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={[T.small, { fontFamily: F.bold, color: "#fff" }]}>{dernier ? "Terminer" : "Suivant"}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Flèche pointant vers l'onglet. */}
          <View style={{ position: "absolute", bottom: -7, left: arrowX - 7, width: 14, height: 14, backgroundColor: C.surface, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.border, transform: [{ rotate: "45deg" }] }} />
        </View>
      </View>
    </Modal>
  );
}
