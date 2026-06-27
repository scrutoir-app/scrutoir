/**
 * Normalisation PARTAGÉE par la recherche exacte ET la recherche sémantique.
 *
 * Volontairement neutre : on se contente de plier la casse et les diacritiques,
 * sans jamais réécrire le SENS d'une requête (cf. neutralité absolue de Scrutoir).
 */

/** Minuscules, sans accents/diacritiques, espaces de bord retirés. Compatible
 *  navigateur ET Node. ⚠️ Identique à l'ancien `norm` d'api.ts (drop-in, 0 régression). */
export function normaliser(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Forme « plate » pour la comparaison de phrases/alias : normalise puis remplace
 *  toute ponctuation par une espace et compresse (« l'ensemble » → « l ensemble »,
 *  « 49.3 » → « 49 3 »). Encadrée d'espaces pour des recherches au mot près. */
export function aplatir(s: string): string {
  return (
    " " +
    normaliser(s)
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}

/** Découpe en jetons alphanumériques (après normalisation). */
export function jetons(s: string): string[] {
  return normaliser(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Mots-outils français + termes procéduraux omniprésents (article, amendement, loi…)
// ignorés en RECHERCHE LEXICALE par mot-clé. Source UNIQUE partagée pipeline (génération
// de recherche-texte.json) et client (tokens de la requête) → matching cohérent.
export const MOTS_OUTILS = new Set([
  "les", "des", "une", "aux", "que", "qui", "pour", "dans", "par", "sur", "avec", "sans",
  "est", "sont", "plus", "cet", "cette", "ces", "son", "ses", "leur", "leurs", "elle",
  "afin", "donc", "mais", "lui", "nos", "vos", "tout", "tous", "toute", "toutes", "the",
  "and", "premier", "premiere", "article", "amendement", "amendements", "proposition",
  "projet", "loi", "ensemble", "alinea", "apres", "avant", "relatif", "relative",
]);

/** Mots-clés porteurs de sens (uniques, ≥ 3 lettres, hors mots-outils) — pour la
 *  recherche lexicale par mot-clé (corpus indexé ET requête, même traitement). */
export function motsCles(s: string): string[] {
  const vus = new Set<string>();
  for (const t of jetons(s)) {
    if (t.length >= 3 && !MOTS_OUTILS.has(t)) vus.add(t);
  }
  return [...vus];
}

/**
 * Distance d'édition de Damerau-Levenshtein BORNÉE (insertion, suppression,
 * substitution, transposition de 2 lettres adjacentes). Sort tôt si la distance
 * dépasse `max` (renvoie `max + 1`) → rapide pour la correction de fautes ciblée.
 */
export function distanceEdition(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prevPrev = new Array<number>(lb + 1);
  let prev = new Array<number>(lb + 1);
  let cur = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let best = cur[0];
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(
        prev[j] + 1, // suppression
        cur[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
      // transposition (Damerau)
      if (i > 1 && j > 1 && ai === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1; // élagage : plus rien sous le seuil
    const tmp = prevPrev;
    prevPrev = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[lb] <= max ? prev[lb] : max + 1;
}
