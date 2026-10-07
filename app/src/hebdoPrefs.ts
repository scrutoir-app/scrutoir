// Dernière édition hebdo ouverte (sur l'appareil, comme les suivis). Sert uniquement à la
// pastille « Nouvelle » de la carte d'accueil : rien n'est envoyé.
const KEY = "scrutoir.hebdo.lue";
let cache: string | null = null;

export function getEditionLue(): string {
  if (cache !== null) return cache;
  try {
    cache = (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) || "";
  } catch {
    cache = "";
  }
  return cache;
}

export function marquerEditionLue(vendredi: string): void {
  if (getEditionLue() >= vendredi) return; // relire une ancienne édition ne rétrograde pas
  cache = vendredi;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, vendredi);
  } catch {
    /* repli mémoire */
  }
}
