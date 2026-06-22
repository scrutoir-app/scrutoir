import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Détecte l'ouverture probable du clavier virtuel (web mobile) pour masquer la barre
 * d'onglets — sinon le clavier la recouvre à moitié (petite, difficile à taper).
 *
 * Détection par le FOCUS d'un champ texte (événements DOM `focusin`/`focusout`), fiable
 * partout y compris en PWA installée iOS — contrairement à l'API VisualViewport, dont le
 * redimensionnement n'est pas garanti en mode standalone. Limité aux écrans tactiles
 * (`pointer: coarse`) pour ne pas masquer la barre sur desktop quand on tape dans un champ.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const coarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;

    const isField = (el: any) =>
      !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

    const onFocusIn = (e: any) => { if (isField(e.target)) setOpen(true); };
    const onFocusOut = () => {
      // Délai 0 : laisse le focus se déplacer (champ → champ) avant de décider.
      setTimeout(() => setOpen(isField(document.activeElement)), 0);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return open;
}
