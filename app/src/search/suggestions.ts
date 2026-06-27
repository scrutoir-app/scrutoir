/**
 * Suggestions « à la frappe » pour la recherche. Dans Scrutoir la recherche est LIVE
 * (résultats affichés au fil de la frappe) et l'exact remonte déjà élus/lois/groupes ;
 * la valeur ajoutée nette de l'autocomplétion est de proposer les THÈMES, qui ne sont pas
 * un type de résultat de recherche mais une page dédiée. On suggère donc les thèmes dont
 * le libellé correspond au texte tapé → l'utilisateur saute directement sur la page du thème.
 *
 * 100 % déterministe et local (depuis categories.json déjà chargé). Aucun appel modèle.
 */
import { normaliser } from "./normalize";

export interface SuggestionTheme {
  id: string;
  libelle: string;
}

interface CatLike {
  id: string;
  libelle: string;
}

/** Thèmes dont le libellé contient le texte tapé (≥ 2 lettres), au plus `n`. */
export function suggererThemes(q: string, cats: CatLike[], n = 3): SuggestionTheme[] {
  const nq = normaliser(q);
  if (nq.length < 2) return [];
  const out: SuggestionTheme[] = [];
  for (const c of cats) {
    if (normaliser(c.libelle).includes(nq)) {
      out.push({ id: c.id, libelle: c.libelle });
      if (out.length >= n) break;
    }
  }
  return out;
}
