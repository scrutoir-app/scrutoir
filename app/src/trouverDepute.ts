// « Trouver ton député » (par code postal, par affinité) : URL de l'API Géo et libellés,
// LOGIQUE PURE (aucun import RN), testée hors app (`trouverDepute.test.ts`, garde de refresh.yml).
// Maquettes validées le 15/10/2026 : `maquette-trouver-depute-ton-siege.html` (code postal) et
// `maquette-trouver-depute-affinite-sobre.html` (affinité).
//
// Ce qui part de l'appareil est écrit ICI, une fois : la saisie (code postal ou nom de commune)
// ou la position arrondie, vers l'API Géo de l'État, et rien d'autre. La phrase affichée sous
// « Me localiser » (`PHRASE_ENVOI`) le dit ; le test vérifie que les URL n'en disent pas plus.

import { SEUIL_FIABILITE } from "./config";

/** API Géo de l'État (geo.api.gouv.fr) : commune d'un code postal, d'un nom ou d'un point. */
export const API_GEO = "https://geo.api.gouv.fr/communes";
const CHAMPS = "nom,code,codeDepartement,codesPostaux";

/** Phrase sous « Me localiser » : exactement ce qui est envoyé, et à qui. */
export const PHRASE_ENVOI =
  "Ta position, arrondie à 100 m, ou ce que tu tapes part à l'API Géo de l'État (geo.api.gouv.fr) pour trouver ta commune. Scrutoir n'en garde rien.";

/** Même phrase, quand l'appareil ne sait pas se localiser (bouton absent) : seule la saisie part. */
export const PHRASE_ENVOI_SAISIE =
  "Ce que tu tapes part à l'API Géo de l'État (geo.api.gouv.fr) pour trouver ta commune. Scrutoir n'en garde rien.";

/** Coordonnée arrondie à 3 décimales (environ 100 m) : assez pour la commune, pas pour l'adresse. */
export function arrondirCoord(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** URL de recherche par saisie : un code postal à 5 chiffres, sinon le nom tapé. null sous 2 caractères. */
export function urlCommunesSaisie(q: string): string | null {
  const s = q.trim();
  if (s.length < 2) return null;
  return /^\d{5}$/.test(s)
    ? `${API_GEO}?codePostal=${s}&fields=${CHAMPS}&format=json`
    : `${API_GEO}?nom=${encodeURIComponent(s)}&fields=${CHAMPS}&boost=population&limit=8&format=json`;
}

/** URL « Me localiser » : latitude et longitude arrondies, rien d'autre. */
export function urlCommuneParCoord(lat: number, lon: number): string {
  return `${API_GEO}?lat=${arrondirCoord(lat)}&lon=${arrondirCoord(lon)}&fields=${CHAMPS}&format=json`;
}

/** Une commune telle que l'écran l'utilise (même forme que `Commune` de api.ts). */
interface CommuneGeo {
  nom: string;
  code: string;
  codeDepartement: string;
  codesPostaux?: string[];
}

const texteCourt = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/**
 * Réponse de l'API Géo, vérifiée avant usage : une liste, et seulement les communes bien formées
 * (nom, code et département en texte ; codes postaux en texte). Une réponse inattendue (objet
 * d'erreur, liste de n'importe quoi) donne [] au lieu de casser l'écran.
 */
export function communesValides(x: unknown): CommuneGeo[] {
  if (!Array.isArray(x)) return [];
  const out: CommuneGeo[] = [];
  for (const c of x) {
    if (!c || typeof c !== "object") continue;
    const { nom, code, codeDepartement, codesPostaux } = c as Record<string, unknown>;
    if (!texteCourt(nom) || !texteCourt(code) || !texteCourt(codeDepartement)) continue;
    out.push(Array.isArray(codesPostaux) ? { nom, code, codeDepartement, codesPostaux: codesPostaux.filter(texteCourt) } : { nom, code, codeDepartement });
  }
  return out;
}

/** « 1re », « 2e »… (numéro de circonscription tel qu'en base, une chaîne). */
export function rangCirco(circo: string | number): string {
  return `${circo}${String(circo) === "1" ? "re" : "e"}`;
}

/** « 2e circonscription », ou « 2e circ. » en version courte (longues listes de puces). */
export function libelleCirco(circo: string | number, court = false): string {
  return `${rangCirco(circo)} ${court ? "circ." : "circonscription"}`;
}

/**
 * Au-dessus des puces de circonscription. Seul le département est connu (l'API Géo ne donne pas
 * la circonscription d'une commune) : on dit combien il en compte, sans prétendre savoir lesquelles
 * le code postal couvre.
 */
export function phraseCircos(n: number): string {
  return n > 1 ? `Ton département compte ${n} circonscriptions. Choisis la tienne.` : "Ton département compte une seule circonscription.";
}

/** Base de la carte d'affinité : « 5 votes sur 7 comparés ». */
export function baseAffinite(accord: number, comparable: number): string {
  return `${accord} vote${accord > 1 ? "s" : ""} sur ${comparable} comparé${comparable > 1 ? "s" : ""}`;
}

/**
 * Le pourcentage de la carte d'affinité, arrondi, ou null sous le seuil de fiabilité : même règle
 * que le résultat du test (« sous 5 votes comparés, on n'affiche pas de pourcentage »).
 */
export function pctAffinite(pct: number, comparable: number, seuil: number = SEUIL_FIABILITE): number | null {
  return comparable >= seuil ? Math.round(pct * 100) : null;
}

const pos = (p: "pour" | "contre") => (p === "pour" ? "Pour" : "Contre");

/** Un vote comparé, dans le détail : « Vous deux : Pour », ou « Toi : Pour · son vote : Contre ». */
export function libelleVoteCompare(toi: "pour" | "contre", sonVote: "pour" | "contre"): string {
  return toi === sonVote ? `Vous deux : ${pos(toi)}` : `Toi : ${pos(toi)} · son vote : ${pos(sonVote)}`;
}
