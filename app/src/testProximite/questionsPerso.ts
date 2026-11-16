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
import type { QuestionProximite, PositionGroupe, Reponse } from "./score";
import type { Origine } from "./storage";

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

// --- Questions hors test : construction, cache, répartition -----------------------------


/** Ce que le cache garde d'un scrutin tranché hors test : sa question et son statut. */
export interface EntreePerso {
  q: QuestionProximite;
  statut: "compte" | MotifExclusion;
}

/** Détail publié d'un scrutin (scrutin/<uid>.json), réduit à ce qu'il faut pour la question. */
export interface DetailPourQuestion extends ScrutinStatut {
  numero: number;
  date?: string | null;
  categorie?: string | null;
  totaux?: Compte;
  groupes: ({ abrev: string | null } & Compte)[];
}

/**
 * Question « perso » d'un scrutin tranché hors test : position de chaque groupe de l'hémicycle
 * = sa position majoritaire (la même règle que l'hémicycle), décomptes repris, thème = catégorie
 * du dossier, sinon du scrutin.
 */
export function questionPerso(d: DetailPourQuestion, themeDossier: string | null | undefined): EntreePerso {
  const positions: Record<string, PositionGroupe> = {};
  const decomptes: Record<string, Compte> = {};
  for (const g of d.groupes) {
    if (!g.abrev) continue;
    decomptes[g.abrev] = { pour: g.pour, contre: g.contre, abstention: g.abstention };
    if (!ORDRE_HEMICYCLE.includes(g.abrev)) continue;
    const p = positionMajoritaire(g);
    if (p) positions[g.abrev] = p;
  }
  const st = statutPerso(d);
  return {
    q: {
      id: d.numero,
      theme: themeDossier || d.categorie || "autre",
      titre: d.titre,
      date: d.date ?? null,
      positions,
      decomptes,
      ...(d.totaux ? { totaux: d.totaux } : null),
      origine: "perso",
    },
    statut: st === "compte" ? "compte" : st.exclu,
  };
}

/** Répartition des réponses hors test, à partir du cache. */
export interface RepartitionPerso {
  /** Questions hors test qui entrent dans le calcul. */
  comptees: QuestionProximite[];
  /** Réponses pour / contre posées hors test sur un budget, une motion ou un vote quasi unanime. */
  horsCalcul: number;
  /** Réponses « sans avis » posées hors test. */
  sansAvis: number;
  /** N° tranchés hors test absents du cache (à reconstruire depuis le détail du scrutin). */
  manquants: number[];
}

/**
 * Réponses posées DEPUIS UN SCRUTIN (origine « scrutin ») hors des questions actuelles du test.
 * Une réponse d'origine « test » à une question RETIRÉE n'est jamais reprise ici.
 */
export function repartirPerso(
  reponses: Record<number, Reponse>,
  origines: Record<number, Origine> | undefined,
  idsTest: ReadonlySet<number>,
  cache: Record<string, EntreePerso | undefined>,
): RepartitionPerso {
  const out: RepartitionPerso = { comptees: [], horsCalcul: 0, sansAvis: 0, manquants: [] };
  for (const [cle, origine] of Object.entries(origines ?? {})) {
    const n = Number(cle);
    const r = reponses[n];
    if (origine !== "scrutin" || r == null || idsTest.has(n)) continue;
    if (r === "sans_avis") { out.sansAvis++; continue; }
    const e = cache[cle];
    if (!e) { out.manquants.push(n); continue; }
    if (e.statut === "compte") out.comptees.push(e.q);
    else out.horsCalcul++;
  }
  return out;
}
