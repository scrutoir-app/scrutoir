// Réglages produit, ajustables côté code.

/**
 * Version publique de l'app (semver MAJEUR.MINEUR.CORRECTIF). Affichée dans l'écran
 * Infos pour que les retours utilisateurs soient rattachables à une version précise.
 * À incrémenter à chaque déploiement (+ entrée dans CHANGELOG.md) :
 *   - CORRECTIF (1.0.x) : corrections, petits ajustements.
 *   - MINEUR   (1.x.0) : nouvelle fonctionnalité visible.
 *   - MAJEUR   (x.0.0) : refonte importante.
 */
export const APP_VERSION = "1.0.45";

/**
 * Seuil minimal de votes nominatifs exprimés (pour + contre + abstention) pour
 * qu'une position thématique (case élu × thème) soit considérée fiable et affichée
 * comme une position. En dessous, la case est grisée et on montre le nombre de
 * votes au lieu d'une position — un échantillon trop faible ne permet pas de conclure.
 */
export const SEUIL_FIABILITE = 5;

/** URL publique d'un scrutin sur le site de l'Assemblée Nationale (source vérifiable). */
export function scrutinSourceUrl(numero: number | null | undefined): string | null {
  return numero ? `https://www.assemblee-nationale.fr/dyn/17/scrutins/${numero}` : null;
}

/** Portail officiel « Vos députés » (pour aider à identifier sa circonscription). */
export const AN_DEPUTES_URL = "https://www.assemblee-nationale.fr/dyn/vos-deputes";
