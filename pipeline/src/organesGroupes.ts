/**
 * Organes successifs d'un MÊME groupe politique.
 *
 * L'Assemblée crée un nouvel organe (nouvel uid PO…) quand un groupe se refonde ou change
 * de nom. Le groupe d'Éric Ciotti en a eu trois dans la 17e législature :
 *   - PO845520 « À Droite » (AD), du 18/07/2024 au 11/09/2024 ;
 *   - PO847173 « UDR », du 12/09/2024 au 04/09/2025 ;
 *   - PO872880 « Union des droites pour la République », depuis le 05/09/2025.
 * Mêmes membres d'un organe à l'autre (vérifié sur AMO20, nov. 2026 : les 16 d'AD sont les
 * 16 de l'UDR 2024-2025 ; 15 d'entre eux siègent dans PO872880, la 16e a quitté l'Assemblée).
 *
 * AMO10 ne publie que l'organe ACTIF : la table `groupes` ne connaît que PO872880. Sans
 * rattachement, les votes 2024-2025 pointaient un groupe inconnu (abrev null) et l'UDR
 * disparaissait du détail par groupe de 2 791 scrutins. On rattache donc chaque organe
 * historique à l'organe actuel, partout où un uid de groupe entre dans la base.
 *
 * Un nouveau renommage ? Ajouter la ligne ici ; le garde-fou d'exportStatic échoue tant
 * qu'un vote pointe un organe inconnu.
 */
export const ORGANE_SUCCESSEUR: Readonly<Record<string, string>> = {
  PO845520: "PO872880",
  PO847173: "PO872880",
};

/** Organe actuel du groupe (lui-même s'il n'a pas de successeur connu). */
export function groupeCanonique(uid: string | null | undefined): string | null {
  if (!uid) return null;
  return ORGANE_SUCCESSEUR[uid] ?? uid;
}

/**
 * « PO0 » : uid vide publié par l'AN à la place du vrai groupe dans la ventilation de 14 scrutins
 * d'amendement (13 le 02/12/2024, 1 le 16/04/2026 ; aucun vote sur l'ensemble d'un texte). Défaut
 * de la source, connu et borné : le garde-fou l'ignore plutôt que de bloquer chaque refresh.
 */
export const ORGANE_SANS_GROUPE = "PO0";
