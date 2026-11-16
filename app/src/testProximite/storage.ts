import type { Reponse } from "./score";

// Persistance LOCALE + partage par URL du test de proximité. 100 % client : rien n'est
// envoyé ni stocké côté serveur (les opinions politiques sont sensibles — RGPD art. 9).
// Web : localStorage. Ailleurs (natif) : fallback mémoire (AsyncStorage = TODO, comme follows).

const KEY = "scrutoir.test-proximite";

/**
 * D'où vient une réponse : du TEST (questions du test, deck, « Affiner ») ou d'un SCRUTIN
 * tranché ailleurs dans l'appli (tiroir de la pastille « comme toi »). Réponse sans origine
 * = « test » (rétrocompatible : avant les votes hors test, tout venait du test). L'origine
 * empêche une réponse à une question RETIRÉE du test de revenir dans le calcul comme vote
 * hors test.
 */
export type Origine = "test" | "scrutin";

export interface EtatTest {
  reponses: Record<number, Reponse>;
  poids: Record<string, number>;
  ts?: number;
  /** Seules les réponses d'origine « scrutin » y figurent ; absente = « test ». */
  origines?: Record<number, Origine>;
}

let memoire: EtatTest | null = null;

// --- Abonnement : les écrans se mettent à jour quand une réponse change (tiroir de vote) ---
// Pas de React ici (module testé hors app) : un compteur de version + des écouteurs, lus par
// `useVersionTest` (useReponses.ts) via useSyncExternalStore.
let version = 0;
const ecouteurs = new Set<() => void>();
/** Numéro de version de l'état du test : change à chaque écriture. */
export function versionTest(): number {
  return version;
}
/** S'abonne aux changements de l'état du test ; renvoie la fonction de désabonnement. */
export function abonnerTest(fn: () => void): () => void {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}
function notifier(): void {
  version++;
  for (const fn of [...ecouteurs]) fn();
}

export function sauverTest(etat: EtatTest): void {
  const v: EtatTest = { ...etat, ts: etat.ts ?? Date.now() };
  if (v.origines && !Object.keys(v.origines).length) delete v.origines;
  memoire = v;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(v));
  } catch { /* quota / mode privé : on garde la mémoire */ }
  notifier();
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
  memoirePerso = {};
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_PERSO);
    }
  } catch { /* ignore */ }
  notifier();
}

// --- Questions HORS TEST en cache (positions des groupes d'un scrutin tranché ailleurs) ---
// Rempli au moment de la réponse (le détail du scrutin est déjà chargé), relu par le « je ».
// Il dit quels scrutins l'utilisateur a tranchés : effacé avec ses réponses (effacerTest,
// retirerReponse), jamais envoyé. Valeurs opaques ici (typées dans questionsPerso.ts).
const KEY_PERSO = "scrutoir.questions-perso";
let memoirePerso: Record<string, unknown> = {};

/** Cache des questions hors test, par n° de scrutin. */
export function lireCachePerso(): Record<string, unknown> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY_PERSO) : null;
    if (raw) return JSON.parse(raw) as Record<string, unknown>;
  } catch { /* illisible */ }
  return memoirePerso;
}

/** Garde la question hors test d'un scrutin (sans notifier : la réponse elle-même l'a fait). */
export function ecrireCachePerso(numero: number, valeur: unknown): void {
  const c = { ...lireCachePerso(), [numero]: valeur };
  memoirePerso = c;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY_PERSO, JSON.stringify(c));
  } catch { /* quota / mode privé : on garde la mémoire */ }
}

function oublierCachePerso(numero: number): void {
  const c = { ...lireCachePerso() };
  if (!(numero in c)) return;
  delete c[numero];
  memoirePerso = c;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY_PERSO, JSON.stringify(c));
  } catch { /* ignore */ }
}

// --- Trois états persistés INDÉPENDAMMENT (cf. correction « poids ») ----------------
// Les réponses s'ACCUMULENT (un passage de test AJOUTE, n'efface rien). Les poids sont un
// choix utilisateur persisté, JAMAIS remis à zéro par un passage du test (seul un reset
// explicite via effacerTest() les efface). La proximité est dérivée (recalculée ailleurs).

/**
 * Fusionne de nouvelles réponses AU TEST (test, deck, « Affiner ») dans l'état stocké, en
 * gardant les poids tels quels. Ces réponses sont d'origine « test » : une origine « scrutin »
 * antérieure sur le même numéro est retirée.
 */
export function fusionnerReponses(nouvelles: Record<number, Reponse>): void {
  const cur = chargerTest();
  const origines = { ...(cur?.origines ?? {}) };
  for (const id of Object.keys(nouvelles)) delete origines[Number(id)];
  sauverTest({ reponses: { ...(cur?.reponses ?? {}), ...nouvelles }, poids: cur?.poids ?? {}, origines });
}

/** Origine d'une réponse stockée (absente = « test »). */
export function origineDe(etat: Pick<EtatTest, "origines"> | null | undefined, numero: number): Origine {
  return etat?.origines?.[numero] ?? "test";
}

/**
 * Réponse posée DEPUIS UN SCRUTIN (tiroir de la pastille « comme toi »). Origine « scrutin »,
 * sauf si le numéro est une question ACTUELLE du test (`questionTest`) : la réponse vaut alors
 * réponse au test. Met à jour l'horodatage (le « je » se recalcule).
 */
export function poserReponse(numero: number, reponse: Reponse, opts: { questionTest?: boolean } = {}): void {
  const cur = chargerTest();
  const origines = { ...(cur?.origines ?? {}) };
  if (opts.questionTest) delete origines[numero];
  else origines[numero] = "scrutin";
  sauverTest({ reponses: { ...(cur?.reponses ?? {}), [numero]: reponse }, poids: cur?.poids ?? {}, origines });
}

/** Efface la réponse à un scrutin (et son origine) : la pastille revient à la déduction. */
export function retirerReponse(numero: number): void {
  const cur = chargerTest();
  if (!cur || cur.reponses[numero] == null) return;
  const reponses = { ...cur.reponses };
  delete reponses[numero];
  const origines = { ...(cur.origines ?? {}) };
  delete origines[numero];
  oublierCachePerso(numero);
  sauverTest({ reponses, poids: cur.poids ?? {}, origines });
}

/** Poids de thèmes persistés (vide si jamais réglés). */
export function chargerPoids(): Record<string, number> {
  return chargerTest()?.poids ?? {};
}

/** Enregistre les poids sans toucher aux réponses (choix utilisateur, persisté seul). */
export function sauverPoids(poids: Record<string, number>): void {
  const cur = chargerTest();
  sauverTest({ reponses: cur?.reponses ?? {}, poids, origines: cur?.origines });
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

/**
 * Encode les réponses (et les poids non neutres) en chaîne compacte URL-safe. Les n° tranchés
 * depuis un scrutin (origine « scrutin ») sont listés à part (`o`) : à l'ouverture, le lien
 * recharge leurs positions pour redonner le même résultat.
 */
export function encoderPartage(reponses: Record<number, Reponse>, poids?: Record<string, number>, origines?: Record<number, Origine>): string {
  const r: Record<string, number> = {};
  for (const [id, rep] of Object.entries(reponses)) r[id] = CODE[rep];
  const payload: { r: Record<string, number>; w?: Record<string, number>; o?: number[] } = { r };
  if (poids && Object.values(poids).some((w) => w !== 1)) payload.w = poids;
  const o = Object.entries(origines ?? {}).filter(([id, v]) => v === "scrutin" && r[id] != null).map(([id]) => Number(id));
  if (o.length) payload.o = o;
  return b64url(JSON.stringify(payload));
}

export function decoderPartage(s: string): { reponses: Record<number, Reponse>; poids?: Record<string, number>; origines?: Record<number, Origine> } | null {
  try {
    const p = JSON.parse(unb64url(s)) as { r?: Record<string, number>; w?: Record<string, number>; o?: unknown };
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
    // Origines : seulement des n° entiers présents dans les réponses.
    let origines: Record<number, Origine> | undefined;
    if (Array.isArray(p.o)) {
      for (const id of p.o) if (Number.isInteger(id) && reponses[id as number] != null) (origines ??= {})[id as number] = "scrutin";
    }
    return { reponses, poids, origines };
  } catch {
    return null;
  }
}

/** URL de partage (web) : recalculée à l'ouverture, sans rien envoyer au serveur. */
export function urlPartage(reponses: Record<number, Reponse>, poids?: Record<string, number>, origines?: Record<number, Origine>): string {
  const enc = encoderPartage(reponses, poids, origines);
  if (typeof window !== "undefined" && window.location) {
    return `${window.location.origin}${window.location.pathname}#test=${enc}`;
  }
  return `https://scrutoir.fr/#test=${enc}`;
}

/** Lit un éventuel résultat partagé dans le hash de l'URL (web). */
export function lireHashPartage(): { reponses: Record<number, Reponse>; poids?: Record<string, number>; origines?: Record<number, Origine> } | null {
  if (typeof window === "undefined" || !window.location?.hash) return null;
  const m = window.location.hash.match(/test=([^&]+)/);
  return m ? decoderPartage(m[1]) : null;
}

/** Utilisateur « situé » = au moins une réponse pour/contre enregistrée (lecture synchrone, au montage). */
export function estSitue(): boolean {
  const t = chargerTest();
  return !!t && Object.values(t.reponses).some((r) => r === "pour" || r === "contre");
}
