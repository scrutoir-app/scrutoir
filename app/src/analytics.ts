/**
 * Traçage analytics « maison », anonyme et non bloquant.
 *
 * Envoie un événement minimal { t: type, e: entité, x: extra } au Worker
 * scrutoir-analytics (Cloudflare Analytics Engine). AUCUN cookie, AUCUN identifiant :
 * on n'envoie que « tel type d'écran/action a eu lieu », jamais « qui ».
 *
 * Où part la mesure : voir `endpointAnalytics`. En dev (`expo start`), rien ne part par
 * défaut ; un build de production (`expo export`) mesure vers le Worker de prod, sauf s'il
 * est servi en local (preview du build) : le trafic interne ne se mêle plus aux visiteurs.
 *
 * Droit d'opposition : Paramètres → « Mesure d'audience anonyme » (clé `scrutoir.mesure`,
 * aussi réglable par `?mesure=off` / `?mesure=on`, cf. arrivee.ts). Coupée, plus rien ne part.
 */

/** Worker de mesure de prod. Pas un secret : il figure aussi dans la CSP (connect-src de `public/_headers`). */
export const ANALYTICS_PROD = "https://scrutoir-analytics.anthony-627.workers.dev/collect";

/** Page servie depuis la machine elle-même (preview locale d'un build, serveur de dev). */
export function hoteLocal(hote: string | undefined | null): boolean {
  if (!hote) return false;
  const h = hote.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h.endsWith(".localhost") || /^127\./.test(h) || h === "::1" || h === "0.0.0.0";
}

/**
 * URL de la mesure, ou "" pour la couper (track() ne fait alors rien).
 *  · EXPO_PUBLIC_ANALYTICS_URL posée au build : elle l'emporte ; vide ou « off » = mesure coupée.
 *    C'est la voie pour tester la mesure en local, vers un Worker local (`wrangler dev`).
 *  · Sinon : le Worker de prod, SEULEMENT dans un build de production (NODE_ENV « production »,
 *    `expo export`). Un serveur de dev n'envoie plus rien au Worker de prod sans qu'on le demande.
 *  · Une page servie en local (`hote` localhost, 127.x) n'écrit JAMAIS dans le Worker de prod,
 *    même dans un build de production, même si on le lui demande.
 */
export function endpointAnalytics(url: string | undefined, nodeEnv: string | undefined, hote?: string | null): string {
  if (url !== undefined) {
    const u = url.trim();
    if (u === "" || u === "off") return "";
    return hoteLocal(hote) && u === ANALYTICS_PROD ? "" : u;
  }
  if (nodeEnv !== "production") return "";
  return hoteLocal(hote) ? "" : ANALYTICS_PROD;
}

function hoteCourant(): string | undefined {
  try {
    return typeof location !== "undefined" ? location.hostname : undefined;
  } catch {
    return undefined;
  }
}

// Lue à l'appel, pas à l'import : dans le bundle, les deux valeurs sont des constantes posées au
// build ; dans les tests (Node), l'espion peut poser EXPO_PUBLIC_ANALYTICS_URL après les imports.
const endpoint = () => endpointAnalytics(process.env.EXPO_PUBLIC_ANALYTICS_URL, process.env.NODE_ENV, hoteCourant());

// --- Opposition à la mesure (réglage local, par appareil) ---

/** Clé localStorage du réglage : "off" coupe la mesure ; absente ou "on" = mesure active. */
export const CLE_MESURE = "scrutoir.mesure";

// Repli mémoire si le stockage est indisponible : un « off » vaut au moins pour cette session.
let repli: boolean | null = null;
const abonnes = new Set<() => void>();

/** La mesure est-elle active sur cet appareil ? Ne lève jamais : en cas de doute, la valeur par défaut (active). */
export function mesureActive(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem(CLE_MESURE);
      if (v === "off") return false;
      if (v === "on") return true;
    }
  } catch {
    /* stockage illisible : repli */
  }
  return repli ?? true;
}

/** Active ou coupe la mesure sur cet appareil (Paramètres, ou `?mesure=on|off`). */
export function reglerMesure(active: boolean): void {
  repli = active;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CLE_MESURE, active ? "on" : "off");
  } catch {
    /* repli mémoire */
  }
  abonnes.forEach((f) => f());
}

/** Abonnement aux changements du réglage (hook `useMesureAudience`, prefs.ts). Renvoie le désabonnement. */
export function abonnerMesure(f: () => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

/**
 * Catégorie d'appareil dérivée de la LARGEUR DE VIEWPORT (pas de l'OS/User-Agent) :
 * c'est la taille d'écran qui compte pour décider d'un affichage desktop. Agrégé et
 * anonyme — on ne stocke qu'une de ces 3 valeurs, jamais de dimensions précises.
 */
function deviceClass(): string {
  try {
    if (typeof window === "undefined" || !window.innerWidth) return "";
    const w = window.innerWidth;
    return w < 600 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  } catch {
    return "";
  }
}

export function track(t: string, e?: string, x?: string): void {
  try {
    if (!mesureActive()) return;
    const url = endpoint();
    if (!url) return;
    const body = JSON.stringify({ t, e: e || "", x: x || "", d: deviceClass() });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, body);
    } else if (typeof fetch === "function") {
      fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* l'analytics ne doit JAMAIS casser l'app */
  }
}
