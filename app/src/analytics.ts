/**
 * Traçage analytics « maison », anonyme et non bloquant.
 *
 * Envoie un événement minimal { t: type, e: entité, x: extra } au Worker
 * scrutoir-analytics (Cloudflare Analytics Engine). AUCUN cookie, AUCUN identifiant :
 * on n'envoie que « tel type d'écran/action a eu lieu », jamais « qui ».
 *
 * L'URL du Worker est injectée au build via EXPO_PUBLIC_ANALYTICS_URL ; sans elle,
 * track() est un no-op (utile en dev / si on veut couper la mesure).
 */
const ENDPOINT =
  process.env.EXPO_PUBLIC_ANALYTICS_URL ||
  "https://scrutoir-analytics.anthony-627.workers.dev/collect";

export function track(t: string, e?: string, x?: string): void {
  try {
    if (!ENDPOINT) return;
    const body = JSON.stringify({ t, e: e || "", x: x || "" });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(ENDPOINT, body);
    } else if (typeof fetch === "function") {
      fetch(ENDPOINT, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* l'analytics ne doit JAMAIS casser l'app */
  }
}
