/**
 * POST /collect : reçoit un événement anonyme et l'écrit dans Analytics Engine.
 * AUCUN cookie, AUCUNE IP stockée, AUCUN identifiant : type d'événement + entité + extra +
 * classe d'appareil, rien d'autre.
 *
 * Module pur (aucun binding, aucun import binaire) : testé par collecte.test.ts.
 */

import {
  APPAREILS,
  ENTREES,
  ISSUES_PARTAGE,
  QUOI_PARTAGE,
  SOURCES,
} from "../../app/src/mesureListes";

/** Écriture Analytics Engine (sous-ensemble de `AnalyticsEngineDataset` utilisé ici). */
export interface Ecrivain {
  writeDataPoint(p: { indexes: string[]; blobs: string[]; doubles: number[] }): void;
}

/**
 * Types acceptés. ⚠️ Un `track("<type>")` de l'app absent d'ici est REJETÉ sans bruit : tout
 * nouveau type s'ajoute ici (le tableau de bord, lui, l'affiche tout seul dans « Autres »).
 */
export const EVENTS = new Set([
  "screen", "depute", "scrutin", "parti", "theme",
  "confront", "shuffle", "follow", "unfollow", "follow_parti", "unfollow_parti",
  "search", "search_empty", "source", "install",
  // Test de proximité : engagement anonyme uniquement (jamais les réponses ni le parti).
  "test_start", "test_done",
  // Partages et provenance des visites : valeurs de listes fermées (mesureListes.ts).
  "share", "arrivee",
  // Parcours d'une loi (interstitiel pédagogique, depuis v1.2.0).
  "parcours_open", "parcours_close",
  // Rubrique Présidentielle 2027 (depuis v1.36.0).
  "presidentielle_open", "programme_open", "chapitre_open", "mesure_open",
  "selection", "filtre", "methode_open",
]);

/** Pour `share` et `arrivee`, l'entité et l'extra appartiennent à une liste fermée ; sinon « autre ». */
const LISTES: Record<string, { e: readonly string[]; x: readonly string[] }> = {
  share: { e: QUOI_PARTAGE, x: ISSUES_PARTAGE },
  arrivee: { e: ENTREES, x: SOURCES },
};

const clip = (s: unknown, n: number): string => (typeof s === "string" ? s : "").slice(0, n);
const dans = (liste: readonly string[], v: string): string => (liste.includes(v) ? v : "autre");

export interface Evenement {
  type: string;
  e: string;
  x: string;
  d: string;
}

/** Événement brut (JSON de l'app) → événement à écrire, ou null si le type est inconnu. */
export function normaliser(ev: unknown): Evenement | null {
  const o = (ev && typeof ev === "object" ? ev : {}) as Record<string, unknown>;
  const type = clip(o.t, 24);
  if (!EVENTS.has(type)) return null;
  let e = clip(o.e, 80);
  let x = clip(o.x, 40);
  const liste = LISTES[type];
  if (liste) {
    e = dans(liste.e, e);
    x = dans(liste.x, x);
  }
  // blob4 = catégorie d'appareil (mobile/tablet/desktop), dérivée du viewport côté app.
  const d0 = clip(o.d, 12);
  const d = (APPAREILS as readonly string[]).includes(d0) ? d0 : "";
  return { type, e, x, d };
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && allowed.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": ok || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Traite un POST /collect. Anti-spam : on n'enregistre que les événements émis depuis NOS
 * origines (l'app en ligne ; plus aucune origine locale depuis la v1.43.0). Réponse 204 dans
 * tous les cas (on ne révèle rien). L'Origin reste falsifiable hors navigateur, mais ça élève
 * la barre sans infra.
 */
export async function traiterCollecte(request: Request, ae: Ecrivain, allowed: string[]): Promise<Response> {
  const origin = request.headers.get("Origin");
  const cors = corsHeaders(origin, allowed);
  if (origin && allowed.includes(origin)) {
    try {
      const ev = normaliser(JSON.parse((await request.text()) || "{}"));
      if (ev) {
        ae.writeDataPoint({ indexes: [ev.type], blobs: [ev.type, ev.e, ev.x, ev.d], doubles: [1] });
      }
    } catch {
      /* corps invalide → ignoré */
    }
  }
  return new Response(null, { status: 204, headers: cors });
}
