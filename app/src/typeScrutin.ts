// Classification d'un scrutin par son INTITULÉ (`titre`), 100 % côté client (aucun champ ni
// requête ajoutés). Même heuristique que le pipeline `pipeline/src/linkAmendements.ts` :
// l'ORDRE des tests compte — l'amendement d'abord, car son intitulé cite souvent le texte
// visé (« amendement n°… à la proposition de loi … »). Générique sur `{ titre?: string | null }`
// pour accepter aussi bien `ScrutinResume` que `VoteScrutin`.

export type TypeScrutin = "tous" | "projet" | "proposition" | "amendement";

/** Classe concrète d'un scrutin (jamais "tous" ; "autre" = motions, déclarations, etc.). */
export type TypeScrutinConcret = "projet" | "proposition" | "amendement" | "autre";

export function classerScrutin(s: { titre?: string | null }): TypeScrutinConcret {
  const t = (s.titre ?? "").toLowerCase();
  if (t.includes("amendement")) return "amendement"; // 1. amendement / sous-amendement
  if (t.includes("projet de loi")) return "projet"; // 2. projet de loi
  if (t.includes("proposition de loi")) return "proposition"; // 3. proposition de loi
  return "autre"; // 4. le reste
}

/** "tous" → liste inchangée ; sinon les scrutins du type demandé. Les "autre" ne sortent que sous "tous". */
export function filtrerParType<T extends { titre?: string | null }>(liste: T[], type: TypeScrutin): T[] {
  if (type === "tous") return liste;
  return liste.filter((s) => classerScrutin(s) === type);
}

export interface ComptesType {
  projet: number;
  proposition: number;
  amendement: number;
}

/** Compte les scrutins par type nommé (sert à savoir quels chips afficher). Les "autre" ne sont pas comptés. */
export function compterParType<T extends { titre?: string | null }>(liste: T[]): ComptesType {
  const c: ComptesType = { projet: 0, proposition: 0, amendement: 0 };
  for (const s of liste) {
    const k = classerScrutin(s);
    if (k !== "autre") c[k] += 1;
  }
  return c;
}

/**
 * N'affiche le filtre que si AU MOINS DEUX des trois types nommés sont présents : un seul
 * type (ou zéro) → rien à trier.
 */
export function doitAfficherFiltreType(c: ComptesType): boolean {
  const presents = (c.projet > 0 ? 1 : 0) + (c.proposition > 0 ? 1 : 0) + (c.amendement > 0 ? 1 : 0);
  return presents >= 2;
}

/**
 * Garde-fou : si le filtre est masqué (moins de 2 types présents), la valeur d'état ne doit
 * pas continuer de filtrer en silence → on la neutralise en "tous". À utiliser côté écran
 * pour dériver le type RÉELLEMENT appliqué.
 */
export function typeEffectif(type: TypeScrutin, c: ComptesType): TypeScrutin {
  return doitAfficherFiltreType(c) ? type : "tous";
}
