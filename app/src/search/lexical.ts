/**
 * Recherche LEXICALE par mot-clé sur le texte enrichi (titre + dossier + thèmes + exposé
 * d'amendement), pré-calculé par le pipeline dans `recherche-texte.json`.
 *
 * Rôle : rattraper les requêtes que le sémantique RATE car les cosinus d'e5-small sont
 * trop tassés sur les titres courts (« carburant », « essence »… absents des titres mais
 * présents dans les exposés). Marche AUSSI hors-ligne / quand le modèle est indisponible
 * (n'a besoin que de ce fichier, pas du modèle) → vrai repli.
 *
 * Gratuit, déterministe, même normalisation que le pipeline (`motsCles`).
 */
import { motsCles } from "./normalize";

const DATA_BASE = process.env.EXPO_PUBLIC_DATA_BASE ?? "";

let corpusP: Promise<Record<string, string>> | null = null;

/** Charge (une fois) le corpus de recherche lexicale : uid → mots-clés (séparés par espace). */
export function chargerCorpusLexical(): Promise<Record<string, string>> {
  if (!corpusP) {
    corpusP = fetch(`${DATA_BASE}/data/recherche-texte.json`).then((r) => {
      if (!r.ok) throw new Error("recherche-texte.json indisponible");
      return r.json();
    });
    corpusP.catch(() => {
      corpusP = null; // pas de cache d'échec
    });
  }
  return corpusP;
}

/**
 * Filtre PUR (testable) : uids dont le texte contient TOUS les mots-clés de la requête
 * (au mot près). `corpus` = uid → mots-clés séparés par espace.
 */
export function filtrerLexical(corpus: Record<string, string>, q: string): string[] {
  const cles = motsCles(q);
  if (!cles.length) return [];
  const out: string[] = [];
  for (const uid in corpus) {
    const doc = " " + corpus[uid] + " ";
    let ok = true;
    for (const c of cles) {
      if (!doc.includes(" " + c + " ")) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(uid);
  }
  return out;
}

/** Recherche lexicale par mot-clé : uids des scrutins contenant tous les mots-clés. */
export async function rechercheLexicale(q: string): Promise<string[]> {
  const corpus = await chargerCorpusLexical();
  return filtrerLexical(corpus, q);
}
