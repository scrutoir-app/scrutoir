// Textes de la pastille « comme toi » et du tiroir de vote, MOT POUR MOT (maquette validée
// « Corriger un vote déduit », 16/11/2026) — LOGIQUE PURE, testée hors app (`texteVote.test.ts`).

import type { Reponse } from "./score";
import type { Verdict } from "./verdict";
import { campGagnant } from "./verdict";
import type { Origine } from "./storage";
import type { StatutPerso } from "./questionsPerso";

export const MOT_REPONSE: Record<Reponse, string> = { pour: "pour", contre: "contre", sans_avis: "sans avis" };

const tranche = (r: unknown): r is "pour" | "contre" => r === "pour" || r === "contre";

/**
 * Une réponse stockée entre-t-elle dans le calcul de la proximité avec les groupes ?
 *  · question ACTUELLE du test : oui (pour ou contre) ;
 *  · réponse du test à une question RETIRÉE (origine « test ») : non, jamais ;
 *  · réponse posée depuis un scrutin : oui, sauf budget, motion, déclaration ou vote quasi unanime.
 * « Sans avis » ne compte jamais.
 */
export function reponseCompte(o: { reponse: Reponse | undefined; dansTest: boolean; origine: Origine; statut: StatutPerso | null }): boolean {
  if (!tranche(o.reponse)) return false;
  if (o.dansTest) return true;
  if (o.origine === "test") return false;
  return o.statut === "compte";
}

/** Ce que dira l'encart du tiroir : une question du test compte toujours. */
export function statutEncart(dansTest: boolean, statut: StatutPerso | null): StatutPerso | null {
  return dansTest ? "compte" : statut;
}

/** Ligne sous la pastille (sans réponse : la ligne « déduit », réservée à la page du scrutin). */
export function ligneVote(o: { reponse: Reponse | undefined; compte: boolean }): string {
  if (o.reponse === undefined) return "Déduit de ton profil. Pas d'accord ? Touche la pastille.";
  if (o.reponse === "sans_avis") return "Ta réponse : sans avis. Plus aucune déduction ici.";
  const mot = MOT_REPONSE[o.reponse];
  return o.compte
    ? `Réponse notée : ${mot}. Elle entre dans le calcul de ta proximité avec les groupes.`
    : `Réponse notée : ${mot}. En revanche, elle ne change pas le calcul de ta proximité avec les groupes.`;
}

/** Titre du tiroir. */
export function titreTiroir(reponse: Reponse | undefined): string {
  return reponse === undefined ? "Ce qu'on a déduit" : "Ton vote sur ce scrutin";
}

/** Texte du tiroir : ta réponse, ou ce qu'on a déduit (et pourquoi « Comme toi » / « Pas comme toi »). */
export function texteTiroir(o: { reponse: Reponse | undefined; verdict: Verdict; sortCode: string | null | undefined }): string {
  if (o.reponse !== undefined) return `Tu as répondu « ${MOT_REPONSE[o.reponse]} ». Change d'avis quand tu veux.`;
  const gagnant = campGagnant(o.sortCode);
  const penche = o.verdict.penche ?? null;
  if (!penche || !gagnant || o.verdict.sens === "partage") return "Ton profil ne permet pas de trancher ce vote. Et toi ?";
  const issue = gagnant === "pour" ? "adopté" : "rejeté";
  const verdict = penche === gagnant ? "Comme toi" : "Pas comme toi";
  return `D'après tes réponses au test, on pense que tu aurais voté ${penche}. L'Assemblée l'a ${issue}, d'où « ${verdict} ». Et toi ?`;
}

/** Encart d'information du tiroir (avant le lien « Comment on déduit »). */
export function encartTiroir(statut: StatutPerso | null): string {
  if (statut === null || statut === "compte")
    return "Pour ou contre entre dans le calcul de ta proximité avec les groupes. Sans avis n'y change rien. Ta réponse reste sur ton téléphone.";
  if (statut.exclu === "unanime")
    return "Presque tous les groupes ont voté pareil. Ta réponse sera notée, en revanche elle ne changera pas le calcul de ta proximité avec les groupes, car ce vote ne les départage pas.";
  return `Ce scrutin porte sur ${statut.nature}. Ta réponse sera notée, en revanche elle ne changera pas le calcul de ta proximité avec les groupes, car ${statut.raison}`;
}
