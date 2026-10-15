/**
 * Traçage analytics « maison », anonyme et non bloquant.
 *
 * Envoie un événement minimal { t: type, e: entité, x: extra } au Worker
 * scrutoir-analytics (Cloudflare Analytics Engine). AUCUN cookie, AUCUN identifiant :
 * on n'envoie que « tel type d'écran/action a eu lieu », jamais « qui ».
 *
 * Où part la mesure : voir `endpointAnalytics`. En dev (`expo start`), rien ne part par
 * défaut ; un build de production (`expo export`) mesure vers le Worker de prod.
 */

/** Worker de mesure de prod. Pas un secret : il figure aussi dans la CSP (connect-src de `public/_headers`). */
export const ANALYTICS_PROD = "https://scrutoir-analytics.anthony-627.workers.dev/collect";

/**
 * URL de la mesure, ou "" pour la couper (track() ne fait alors rien).
 *  · EXPO_PUBLIC_ANALYTICS_URL posée au build : elle l'emporte ; vide ou « off » = mesure coupée.
 *  · Sinon : le Worker de prod, SEULEMENT dans un build de production (NODE_ENV « production »,
 *    `expo export`). Un serveur de dev n'envoie plus rien au Worker de prod sans qu'on le demande.
 */
export function endpointAnalytics(url: string | undefined, nodeEnv: string | undefined): string {
  if (url !== undefined) {
    const u = url.trim();
    return u === "" || u === "off" ? "" : u;
  }
  return nodeEnv === "production" ? ANALYTICS_PROD : "";
}

// Lue à l'appel, pas à l'import : dans le bundle, les deux valeurs sont des constantes posées au
// build ; dans les tests (Node), l'espion peut poser EXPO_PUBLIC_ANALYTICS_URL après les imports.
const endpoint = () => endpointAnalytics(process.env.EXPO_PUBLIC_ANALYTICS_URL, process.env.NODE_ENV);

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
