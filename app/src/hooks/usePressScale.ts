import { useRef } from "react";
import { Animated, Easing, Platform } from "react-native";
import { useReduceMotion } from "../components/HeroScrutins";

const natif = Platform.OS !== "web";

/**
 * Retour de pression : le contrôle se resserre à 0,97 en 120 ms, puis revient. Coupé quand
 * l'utilisateur a demandé des animations réduites. À poser sur un `Animated.View` qui enveloppe
 * le contrôle (`style`), avec `onPressIn` / `onPressOut` sur le contrôle lui-même.
 */
export function usePressScale() {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(1)).current;
  const aller = (to: number) => {
    if (reduce) return;
    Animated.timing(v, { toValue: to, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: natif }).start();
  };
  return {
    style: { transform: [{ scale: v }] },
    onPressIn: () => aller(0.97),
    onPressOut: () => aller(1),
  };
}
