import type { TriTextes } from "./hebdo";

// Onglet Scrutins : ce qui s'affiche selon le sous-onglet et la saisie, et la mémoire de session
// de l'onglet. Sans React (testé depuis pipeline/, où React n'est pas installé).
//
// Règle « une seule recherche visible » (maquette du 11/11/2026) : sur le sous-onglet Recherche,
// il n'y a qu'UN champ de saisie. Tant que la saisie est vide, il est au centre du bloc sombre
// « Sur quoi ils ont voté ? » et rien n'est affiché en haut de l'écran. Dès qu'elle ne l'est plus,
// le même champ passe en haut, avec le bouton effacer, et les sous-onglets s'effacent. C'est le
// même TextInput, à la même place dans l'arbre (cf. RechercheTextes) : seul son habillage change,
// donc le clavier reste ouvert et le curseur ne saute pas.

export type OngletScrutins = "recherche" | "textes";

export interface VueRecherche {
  /** Les sous-onglets « Recherche | Textes » en haut de l'écran. */
  sousOnglets: boolean;
  /** Le bloc sombre central, avec le champ, les suggestions et le placeholder. */
  blocCentral: boolean;
  /** Le champ en haut de l'écran, requête pré-remplie et bouton effacer. */
  barreEnHaut: boolean;
}

export function vueRecherche(onglet: OngletScrutins, q: string): VueRecherche {
  const recherche = onglet === "recherche";
  const saisie = q.trim().length > 0;
  return {
    sousOnglets: !(recherche && saisie),
    blocCentral: recherche && !saisie,
    barreEnHaut: recherche && saisie,
  };
}

export const NB_TEXTES = 30; // textes affichés dans « Textes », puis par tranches de 30

export interface MemoireScrutins {
  onglet: OngletScrutins;
  q: string;
  tri: TriTextes;
  theme: string | null;
  n: number;
}

// Mémoire de SESSION de l'onglet : App ne rend que l'écran au sommet de la pile, l'état local se
// perdrait en ouvrant un texte ou un scrutin. Au retour, l'onglet repart de cette mémoire (même
// sous-onglet, même requête, donc barre du haut comprise). En mémoire seulement : rien sur
// l'appareil, rien sur le réseau.
const memoire: MemoireScrutins = { onglet: "recherche", q: "", tri: "recent", theme: null, n: NB_TEXTES };

export function memoireScrutins(): Readonly<MemoireScrutins> {
  return memoire;
}

export function retenirScrutins(maj: Partial<MemoireScrutins>): void {
  Object.assign(memoire, maj);
}
