import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Détecte l'ouverture du clavier virtuel sur le web (mobile) via l'API VisualViewport.
 * Quand le clavier s'ouvre, le viewport visible rétrécit nettement par rapport à la
 * fenêtre. Sert à masquer la barre d'onglets (sinon le clavier la recouvre à moitié →
 * petite et difficile à taper). Comportement standard des apps natives.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      // Marge de 150 px : un clavier fait toujours plus que ça ; évite les faux positifs
      // (barres d'outils du navigateur qui changent de quelques dizaines de px).
      setOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener("resize", onResize);
    onResize();
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  return open;
}
