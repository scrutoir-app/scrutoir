// Réglages produit, ajustables côté code.

/**
 * Seuil minimal de votes nominatifs exprimés (pour + contre + abstention) pour
 * qu'une position thématique (case élu × thème) soit considérée fiable et affichée
 * comme une position. En dessous, la case est grisée et on montre le nombre de
 * votes au lieu d'une position — un échantillon trop faible ne permet pas de conclure.
 */
export const SEUIL_FIABILITE = 5;
