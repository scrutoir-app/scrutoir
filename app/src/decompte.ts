// Décomptes de vote EN CLAIR (« 10 pour, 1 abst. », « Unanime : 23 pour ») — LOGIQUE PURE,
// aucun import RN : testée hors app (`decompte.test.ts`, garde de refresh.yml). Remplace les
// barres sans légende et les abréviations « 14 p · 1 a » : on écrit les nombres en toutes lettres.

export interface Compte {
  pour: number;
  contre: number;
  abstention: number;
}

export type PositionVote = "pour" | "contre" | "abstention";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312

/** « 10 pour, 1 abst. » (seules les positions non nulles, ordre pour · contre · abst.) ; "" si aucun vote. */
export function decompteClair(c: Compte): string {
  return [
    c.pour > 0 ? `${fmt(c.pour)} pour` : null,
    c.contre > 0 ? `${fmt(c.contre)} contre` : null,
    c.abstention > 0 ? `${fmt(c.abstention)} abst.` : null,
  ].filter(Boolean).join(", ");
}

export interface DecompteGroupe {
  /** unanime = tous les sièges du groupe, même avis ; seul = une seule position, sans tout le groupe ; divise = plusieurs positions. */
  etat: "unanime" | "seul" | "divise" | "aucun";
  /** Position commune (unanime / seul), null si divisé ou aucun vote. */
  position: PositionVote | null;
  texte: string;
}

/**
 * Position d'un GROUPE sur un scrutin, dite en clair :
 *  · unanime : « Unanime : 23 pour » — une seule position ET autant de voix que de sièges du groupe ;
 *  · une seule position, sans tout le groupe : « 19 pour, aucun contre » ;
 *  · plusieurs positions : « 18 pour, 1 contre, 4 abst. » (étiquette « Divisé » côté écran).
 * `effectif` = sièges actuels du groupe. Les absents d'un scrutin ne sont pas dans les données (seuls
 * les non-votants le sont) : sans effectif connu, on ne dit jamais « unanime ». Règle prudente : un
 * groupe qui a perdu un membre depuis le vote peut être dit « 22 pour, aucun contre » — vrai, sans plus.
 */
export function decompteGroupe(c: Compte, effectif?: number | null): DecompteGroupe {
  const nonNuls = (["pour", "contre", "abstention"] as const).filter((p) => c[p] > 0);
  if (!nonNuls.length) return { etat: "aucun", position: null, texte: "aucun vote exprimé" };
  if (nonNuls.length > 1) return { etat: "divise", position: null, texte: decompteClair(c) };
  const p = nonNuls[0];
  const seul = decompteClair(c);
  if (effectif != null && effectif > 0 && c[p] >= effectif) return { etat: "unanime", position: p, texte: `Unanime : ${seul}` };
  const aucun = p === "pour" ? "aucun contre" : p === "contre" ? "aucun pour" : "aucun pour ni contre";
  return { etat: "seul", position: p, texte: `${seul}, ${aucun}` };
}
