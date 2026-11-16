// Votes HORS TEST (réponses posées depuis un scrutin) — LOGIQUE PURE, aucun import RN :
// testée hors app (`questionsPerso.test.ts`).
//
// Une réponse posée sur n'importe quel scrutin est toujours notée (pastille « voté », Tes
// accords). Elle n'entre dans le calcul de la proximité que si le scrutin départage les groupes
// sur une mesure lisible. Mêmes exclusions que pour le choix des questions du test :
//  · budget (vote sur l'ensemble ou sur une partie d'une loi de finances, de financement de la
//    sécurité sociale, de règlement du budget / d'approbation des comptes) : des centaines de
//    mesures, un pour ou un contre ne dit pas lesquelles on soutient. Les amendements et les
//    articles d'un budget, eux, comptent : ils portent sur une mesure lisible ;
//  · motion de censure, motion de procédure, déclaration du Gouvernement : le sort du
//    gouvernement ou la procédure, pas le fond d'une mesure ;
//  · vote quasi unanime : aucun groupe majoritairement pour face à un groupe majoritairement
//    contre, la réponse ne départage personne.

import { natureScrutin, type Nature } from "../hebdo";
import { positionMajoritaire, type Compte } from "../decompte";
import { ORDRE_HEMICYCLE } from "../components/hemicycleGeo";

/** Pourquoi un scrutin reste hors du calcul. */
export type MotifExclusion = "budget" | "censure" | "procedure" | "declaration" | "unanime";

export type StatutPerso = "compte" | { exclu: MotifExclusion; nature: string | null; raison: string };

/** Ce qu'il faut savoir d'un scrutin pour décider s'il compte (détail du scrutin publié). */
export interface ScrutinStatut {
  titre: string | null;
  type_vote?: string | null;
  dossier_titre?: string | null;
  groupes: ({ abrev: string | null } & Partial<Compte>)[];
}

const RAISON_BUDGET =
  "un budget regroupe des centaines de mesures : un pour ou un contre ne dit pas lesquelles tu soutiens.";
const RAISON_MOTION =
  "une motion porte sur le sort du gouvernement ou sur la procédure, pas sur le fond d'une mesure.";
const RAISON_UNANIME = "ce vote ne les départage pas.";

const NATURE_MOTION: Partial<Record<Nature, { motif: MotifExclusion; nature: string }>> = {
  censure: { motif: "censure", nature: "une motion de censure" },
  procedure: { motif: "procedure", nature: "une motion de procédure" },
  declaration: { motif: "declaration", nature: "une déclaration du gouvernement" },
};

const norm = (t: string | null | undefined) => (t ?? "").toLowerCase().replace(/[’`]/g, "'");
const BUDGET = ["loi de finances", "financement de la sécurité sociale", "règlement du budget", "approbation des comptes"];

/** Le texte est-il un budget (loi de finances, PLFSS, règlement / approbation des comptes) ? */
export function estTexteBudget(...titres: (string | null | undefined)[]): boolean {
  return titres.some((t) => {
    const n = norm(t);
    return BUDGET.some((m) => n.includes(m));
  });
}

/** Aucun groupe de l'hémicycle majoritairement pour face à un groupe majoritairement contre. */
export function estQuasiUnanime(groupes: ScrutinStatut["groupes"]): boolean {
  let pour = false;
  let contre = false;
  for (const g of groupes) {
    if (!g.abrev || !ORDRE_HEMICYCLE.includes(g.abrev)) continue; // non-inscrits : pas un groupe
    const p = positionMajoritaire(g);
    if (p === "pour") pour = true;
    else if (p === "contre") contre = true;
  }
  return !(pour && contre);
}

/** Une réponse posée sur ce scrutin compte-t-elle dans la proximité (hors questions du test) ? */
export function statutPerso(s: ScrutinStatut): StatutPerso {
  const nat = natureScrutin({ titre: s.titre, type_vote: s.type_vote ?? null });
  const motion = NATURE_MOTION[nat];
  if (motion) return { exclu: motion.motif, nature: motion.nature, raison: RAISON_MOTION };
  if ((nat === "ensemble" || nat === "partie") && estTexteBudget(s.titre, s.dossier_titre))
    return { exclu: "budget", nature: "un budget", raison: RAISON_BUDGET };
  if (estQuasiUnanime(s.groupes)) return { exclu: "unanime", nature: null, raison: RAISON_UNANIME };
  return "compte";
}
