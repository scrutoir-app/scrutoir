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
  return appareilIOS(navigator.userAgent || "", (navigator as any).maxTouchPoints || 0);
}

// --- Contexte d'arrivée : où tourne Scrutoir, pour proposer la bonne installation ---------
//
// Les faits qui fondent les écrans d'arrivée (cf. ArriveeEcran, RepriseEcran) :
//  · iPhone / iPad : l'app ajoutée à l'écran d'accueil a son PROPRE stockage, séparé de Safari.
//    Safari efface aussi le stockage d'un site après 7 jours d'usage sans visite de ce site.
//  · Android + Chrome : l'app installée partage le stockage de Chrome. Rien ne se perd.
//  · Navigateurs intégrés (Instagram, Facebook, TikTok, Snapchat, LinkedIn) : pas d'installation,
//    stockage enfermé dans l'appli hôte.
//  · Ordinateur : rien ne change.

export type ContexteArrivee =
  | "installee"
  | "integre-ios"
  | "integre-android"
  | "ios"
  | "android-installable"
  | "android"
  | "ordinateur";

/** Ce que lit `contexteArrivee` : passé en argument pour être testé hors navigateur. */
export interface EnvArrivee {
  ua: string;
  standalone: boolean;
  /** `beforeinstallprompt` reçu et gardé (`getDeferredPrompt()`). */
  invite: boolean;
  /** `navigator.maxTouchPoints` : un iPad en Safari se présente comme un Mac, mais tactile. */
  pointsTactiles?: number;
}

/** Appli hôte d'un navigateur intégré, par l'user agent. `nom` null = appli reconnue sans nom affichable. */
const APPLIS_HOTES: { re: RegExp; nom: string | null }[] = [
  { re: /\bInstagram\b/, nom: "Instagram" },
  { re: /MessengerForiOS|Orca-Android/, nom: null }, // Messenger porte aussi FBAN/FBAV
  { re: /FBAN|FBAV|FB_IAB/, nom: "Facebook" },
  { re: /musical_ly|BytedanceWebview/, nom: "TikTok" },
  { re: /\bSnapchat\b/, nom: "Snapchat" },
  { re: /LinkedInApp/, nom: "LinkedIn" },
];

/** Navigateur intégré à une appli (Instagram…) ? `undefined` = non ; `null` = oui, appli sans nom affichable. */
export function appliHote(ua: string): string | null | undefined {
  for (const a of APPLIS_HOTES) if (a.re.test(ua)) return a.nom;
  return undefined;
}

/** iPhone, iPod, iPad (y compris l'iPad en Safari, qui se présente comme un Mac tactile). */
export function appareilIOS(ua: string, pointsTactiles = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Macintosh/.test(ua) && pointsTactiles > 1;
}

/** Navigateur iOS : Safari, Chrome (`CriOS`, « Sur l'écran d'accueil » depuis iOS 16.4) ou un autre. */
export function navigateurIOS(ua: string): "safari" | "chrome" | "autre" {
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS|EdgiOS|OPiOS|YaBrowser|DuckDuckGo/.test(ua)) return "autre";
  return "safari";
}

/** Contexte d'arrivée : première règle qui s'applique. */
export function contexteArrivee(env: EnvArrivee = envNavigateur()): ContexteArrivee {
  if (env.standalone) return "installee";
  const ios = appareilIOS(env.ua, env.pointsTactiles);
  const android = !ios && /Android/i.test(env.ua);
  if (appliHote(env.ua) !== undefined) {
    if (ios) return "integre-ios";
    if (android) return "integre-android";
  }
  if (ios) return "ios";
  if (android) return env.invite ? "android-installable" : "android";
  return "ordinateur";
}

/**
 * Serveur de dev uniquement (`expo start`, `__DEV__`) : contexte forcé pour les captures et les
 * vérifications, par la clé locale `scrutoir.dev.env` (EnvArrivee partiel, en JSON). Absent d'un
 * build de production (`__DEV__` vaut false, le bloc disparaît).
 */
function surchargeDev(): Partial<EnvArrivee> | null {
  try {
    if (typeof __DEV__ === "undefined" || !__DEV__ || typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem("scrutoir.dev.env");
    return raw ? (JSON.parse(raw) as Partial<EnvArrivee>) : null;
  } catch {
    return null;
  }
}

/** L'environnement réel (navigateur) ; neutre hors navigateur. */
export function envNavigateur(): EnvArrivee {
  if (typeof navigator === "undefined") return { ua: "", standalone: false, invite: false };
  const env: EnvArrivee = {
    ua: navigator.userAgent || "",
    standalone: isStandalone(),
    invite: !!deferred,
    pointsTactiles: (navigator as any).maxTouchPoints || 0,
  };
  const dev = surchargeDev();
  return dev ? { ...env, ...dev } : env;
}

/** iPhone ou iPad, hors navigateur intégré et hors app installée : là où les réponses vivent dans le navigateur. */
export function estIOSNavigateur(): boolean {
  return contexteArrivee() === "ios";
}

/** App installée sur iPhone ou iPad (stockage séparé de Safari). */
export function estIOSInstallee(env: EnvArrivee = envNavigateur()): boolean {
  return env.standalone && appareilIOS(env.ua, env.pointsTactiles);
}

/** Nom de l'appareil iOS dans les textes : « iPad » (y compris l'iPad qui se dit Mac), sinon « iPhone ». */
export function nomAppareilIOS(env: EnvArrivee = envNavigateur()): "iPhone" | "iPad" {
  return /iPad/.test(env.ua) || (/Macintosh/.test(env.ua) && (env.pointsTactiles ?? 0) > 1) ? "iPad" : "iPhone";
}

/** Nom du navigateur iOS dans les textes (« Faire le test dans Safari »). */
export function nomNavigateurIOS(ua: string = envNavigateur().ua): string {
  const n = navigateurIOS(ua);
  return n === "chrome" ? "Chrome" : n === "safari" ? "Safari" : "ce navigateur";
}

/** Nom du navigateur Android dans les textes (« Chrome et l'app partagent tes réponses »). */
export function nomNavigateurAndroid(ua: string = envNavigateur().ua): string {
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/EdgA\//.test(ua)) return "Edge";
  return "Chrome";
}
