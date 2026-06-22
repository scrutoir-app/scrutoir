/**
 * Aide à l'installation PWA (web only).
 *
 * - Android / Chromium : on capte `beforeinstallprompt` AU PLUS TÔT (au chargement
 *   du module, avant le montage React) pour ne pas le rater, et on l'expose pour
 *   déclencher la vraie pop-up d'installation native au clic d'un bouton.
 * - iOS / Safari : Apple n'expose AUCUN moyen de déclencher « Sur l'écran d'accueil ».
 *   On ne peut que détecter la situation et afficher une notice manuelle.
 */
let deferred: any = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault(); // empêche la mini-bannière auto du navigateur : on gère l'UI nous-mêmes
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getDeferredPrompt(): any {
  return deferred;
}

export function onPromptChange(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

/** Déclenche la pop-up native (Android/Chromium). true si l'utilisateur accepte. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  deferred.prompt();
  let outcome = "dismissed";
  try {
    outcome = (await deferred.userChoice)?.outcome || "dismissed";
  } catch {
    /* ignore */
  }
  deferred = null;
  notify();
  return outcome === "accepted";
}

/** L'app tourne-t-elle déjà en mode installé (écran d'accueil) ? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (window.navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

/** iPhone / iPad / iPod (où l'install ne peut se faire que manuellement via Safari). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}
