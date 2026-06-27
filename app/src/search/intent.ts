/**
 * Routage d'intention + suggestion « vouliez-vous dire » — couche déterministe.
 *
 * - numéro de scrutin → recherche directe (le sémantique est inutile).
 * - alias de parti exact → recherche exacte prioritaire.
 * - sinon → « sujet » : on lance la recherche sémantique EN PLUS de l'exacte.
 *
 * La correction de fautes est CIBLÉE (uniquement vers un vocabulaire connu : alias,
 * partis, grands thèmes) et conservatrice, pour ne jamais réécrire une vraie requête.
 * Neutre : aucune réécriture de sens, on ne fait que corriger l'orthographe.
 */
import { distanceEdition, jetons, normaliser } from "./normalize";
import { ALIAS_PARTIS, ALIASES, etendreRequete, type CorrespondanceAlias } from "./aliases";

export type TypeIntention = "numero" | "exact" | "sujet";

export interface Intention {
  type: TypeIntention;
  /** Numéro de scrutin si type === "numero". */
  numero: number | null;
  /** Requête enrichie des expansions d'alias (à vectoriser). */
  enrichi: string;
  /** Alias reconnus (affichage / debug). */
  correspondances: CorrespondanceAlias[];
  /** Requête corrigée proposée, ou null si aucune correction fiable. */
  suggestion: string | null;
}

// « scrutin 7380 », « vote n° 7380 », « n°7380 », « numéro 7380 », ou un nombre seul.
const RE_NUM_MOT = /(?:scrutin|vote|n[°o]|numero)\s*#?\s*(\d{1,6})/;
const RE_NUM_SEUL = /^\s*#?\s*(\d{1,6})\s*$/;

function detecterNumero(q: string): number | null {
  const n = normaliser(q);
  const m = n.match(RE_NUM_SEUL) || n.match(RE_NUM_MOT);
  return m ? parseInt(m[1], 10) : null;
}

/** Vocabulaire pour la correction de fautes : alias, partis, grands thèmes. */
const VOCAB: string[] = (() => {
  const set = new Set<string>();
  const add = (s: string) => {
    for (const t of jetons(s)) if (t.length >= 4) set.add(t);
  };
  for (const a of ALIASES) {
    a.cles.forEach(add);
    add(a.concept);
  }
  Object.keys(ALIAS_PARTIS).forEach(add);
  [
    "ecologie", "climat", "securite", "justice", "economie", "budget", "fiscalite",
    "travail", "emploi", "chomage", "sante", "hopital", "education", "recherche",
    "immigration", "asile", "solidarites", "institutions", "democratie", "libertes",
    "agriculture", "alimentation", "international", "defense", "logement", "territoires",
    "retraite", "nucleaire", "avortement", "energie", "police", "nationalisation",
  ].forEach((w) => set.add(w));
  return [...set];
})();
const VOCAB_SET = new Set(VOCAB);

/** Corrige les jetons clairement fautifs vers le vocabulaire connu (conservateur). */
function suggerer(q: string): string | null {
  const bruts = q.trim().split(/(\s+)/); // garde les espaces pour reconstruire
  let corrige = false;
  const out = bruts.map((part) => {
    const tok = normaliser(part);
    if (tok.length < 4 || VOCAB_SET.has(tok) || /\d/.test(tok)) return part;
    const max = tok.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestD = max + 1;
    for (const cand of VOCAB) {
      if (Math.abs(cand.length - tok.length) > max) continue;
      const d = distanceEdition(tok, cand, max);
      if (d < bestD) {
        bestD = d;
        best = cand;
      }
    }
    if (best && bestD <= max && best !== tok) {
      corrige = true;
      // Conserve la casse simple (tout en minuscule, comme la saisie usuelle).
      return best;
    }
    return part;
  });
  if (!corrige) return null;
  const s = out.join("").replace(/\s+/g, " ").trim();
  return s && normaliser(s) !== normaliser(q) ? s : null;
}

/** Analyse complète d'une requête (numéro / exact / sujet + enrichissement + suggestion). */
export function routerIntention(q: string): Intention {
  const numero = detecterNumero(q);
  if (numero != null) {
    return { type: "numero", numero, enrichi: q.trim(), correspondances: [], suggestion: null };
  }
  const { enrichi, correspondances } = etendreRequete(q);
  const exactParti = ALIAS_PARTIS[normaliser(q)] != null;
  const suggestion = suggerer(q);
  return {
    type: exactParti ? "exact" : "sujet",
    numero: null,
    enrichi,
    correspondances,
    suggestion,
  };
}
