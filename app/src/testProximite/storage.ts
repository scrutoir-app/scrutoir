import type { Reponse } from "./score";

// Persistance LOCALE + partage par URL du test de proximité. 100 % client : rien n'est
// envoyé ni stocké côté serveur (les opinions politiques sont sensibles — RGPD art. 9).
// Web : localStorage. Ailleurs (natif) : fallback mémoire (AsyncStorage = TODO, comme follows).

const KEY = "scrutoir.test-proximite";

export interface EtatTest {
  reponses: Record<number, Reponse>;
  poids: Record<string, number>;
  ts?: number;
}

let memoire: EtatTest | null = null;

export function sauverTest(etat: EtatTest): void {
  const v: EtatTest = { ...etat, ts: etat.ts ?? Date.now() };
  memoire = v;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(v));
  } catch { /* quota / mode privé : on garde la mémoire */ }
}

export function chargerTest(): EtatTest | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) return JSON.parse(raw) as EtatTest;
  } catch { /* illisible */ }
  return memoire;
}

export function effacerTest(): void {
  memoire = null;
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

// --- Partage : encodage compact des réponses (+ poids) dans un hash d'URL ----------
// Aucun stockage distant, aucun compte. Le lien recalcule tout à l'ouverture.

const CODE: Record<Reponse, number> = { sans_avis: 0, pour: 1, contre: 2 };
const DECODE: Record<number, Reponse> = { 0: "sans_avis", 1: "pour", 2: "contre" };

function b64url(s: string): string {
  const b = typeof btoa !== "undefined" ? btoa(s) : s; // web : btoa ; natif : best-effort
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): string {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob !== "undefined" ? atob(t) : t;
}

/** Encode les réponses (et les poids non neutres) en chaîne compacte URL-safe. */
export function encoderPartage(reponses: Record<number, Reponse>, poids?: Record<string, number>): string {
  const r: Record<string, number> = {};
  for (const [id, rep] of Object.entries(reponses)) r[id] = CODE[rep];
  const payload: { r: Record<string, number>; w?: Record<string, number> } = { r };
  if (poids && Object.values(poids).some((w) => w !== 1)) payload.w = poids;
  return b64url(JSON.stringify(payload));
}

export function decoderPartage(s: string): { reponses: Record<number, Reponse>; poids?: Record<string, number> } | null {
  try {
    const p = JSON.parse(unb64url(s)) as { r?: Record<string, number>; w?: Record<string, number> };
    const reponses: Record<number, Reponse> = {};
    for (const [id, c] of Object.entries(p.r ?? {})) {
      const n = Number(id);
      // Ne garder que des ids entiers et des codes connus (0/1/2) — un lien trafiqué
      // ne doit pas injecter de clé NaN ni de réponse hors barème.
      if (Number.isInteger(n) && (c === 0 || c === 1 || c === 2)) reponses[n] = DECODE[c];
    }
    // Poids : seulement des nombres finis bornés (évite NaN/poids absurde dans le score).
    let poids: Record<string, number> | undefined;
    if (p.w && typeof p.w === "object") {
      poids = {};
      for (const [k, w] of Object.entries(p.w))
        if (typeof w === "number" && isFinite(w) && w >= 0 && w <= 3) poids[k] = w;
    }
    return { reponses, poids };
  } catch {
    return null;
  }
}

/** URL de partage (web) : recalculée à l'ouverture, sans rien envoyer au serveur. */
export function urlPartage(reponses: Record<number, Reponse>, poids?: Record<string, number>): string {
  const enc = encoderPartage(reponses, poids);
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}${window.location.pathname}#test=${enc}`;
  }
  return `https://scrutoir.fr/#test=${enc}`;
}

/** Lit un éventuel résultat partagé dans le hash de l'URL (web). */
export function lireHashPartage(): { reponses: Record<number, Reponse>; poids?: Record<string, number> } | null {
  if (typeof window === "undefined" || !window.location?.hash) return null;
  const m = window.location.hash.match(/test=([^&]+)/);
  return m ? decoderPartage(m[1]) : null;
}
