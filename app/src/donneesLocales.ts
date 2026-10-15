import { chargerTest, effacerTest } from "./testProximite/storage";
import { reinitialiserSelection } from "./testProximite/selectionDuJour";
import { viderPasses } from "./passedDeputes";
import { getFollows, viderSuivis } from "./follows";
import { getKept, viderKept } from "./keptScrutins";
import { semantiqueAutorisee, modeleDejaEnCache, supprimerModele } from "./search/consent";

/**
 * Ce que Scrutoir garde SUR L'APPAREIL, et comment l'effacer (Paramètres → « Sur cet
 * appareil »). Tout est local : aucune de ces fonctions n'appelle le réseau ni track() —
 * les réponses au test sont des opinions politiques (RGPD art. 9), et un effacement mesuré
 * dirait déjà quelque chose de l'utilisateur.
 *
 * Ne touche PAS à l'affichage (thème, avatars) ni aux repères « déjà vu » (visite guidée,
 * parcours d'une loi…) : ce sont des réglages, pas des données personnelles.
 */

export interface DonneesLocales {
  /** Le test a-t-il un état stocké (réponses ou poids) ? */
  test: boolean;
  /** Nombre de réponses au test (« sans avis » compris). */
  reponses: number;
  suivis: number;
  gardes: number;
}

export function lireDonneesLocales(): DonneesLocales {
  const t = chargerTest();
  return {
    test: !!t && (Object.keys(t.reponses ?? {}).length > 0 || Object.keys(t.poids ?? {}).length > 0),
    reponses: Object.keys(t?.reponses ?? {}).length,
    suivis: getFollows().length,
    gardes: getKept().length,
  };
}

/** État du modèle de recherche : en cache, seulement autorisé, ou absent (null). */
export async function lireEtatModele(): Promise<"cache" | "autorise" | null> {
  if (await modeleDejaEnCache()) return "cache";
  return semantiqueAutorisee() ? "autorise" : null;
}

/**
 * Efface les réponses au test ET ce qui en dérive sur l'appareil : le lot quotidien du deck
 * « Trouver ton député » (tiré par étages de proximité) et les députés passés dans ce deck.
 */
export function effacerReponsesTest(): void {
  effacerTest();
  reinitialiserSelection();
  viderPasses();
}

export { viderKept as effacerScrutinsGardes, supprimerModele };

/** « Tout effacer sur cet appareil » : réponses (+ dérivés), suivis, scrutins gardés, modèle. */
export async function toutEffacer(): Promise<void> {
  effacerReponsesTest();
  viderSuivis();
  viderKept();
  await supprimerModele();
}
