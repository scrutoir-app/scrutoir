// Le « JE » transverse : à partir du test de proximité enregistré localement, expose la
// proximité de l'utilisateur avec un GROUPE ou un DÉPUTÉ, réutilisable sur n'importe quel
// écran (partis, profils, suivis). 100 % client — repose sur le moteur pur `calculerProximite`
// (cf. score.ts) et la persistance locale (cf. storage.ts). Sans « je » (test non fait),
// tout renvoie null → l'appelant n'affiche rien.

import { useEffect, useState } from "react";
import { getTestProximite, getPartis, getVotesBruts } from "../api";
import { chargerTest } from "./storage";
import {
  calculerProximite,
  scoreVotant,
  type QuestionProximite,
  type ResultatProximite,
  type Reponse,
  type ProximiteScore,
} from "./score";

/** Seuil de fiabilité d'un score affiché (cf. brief : « moins de 3 scrutins comparés » = peu fiable). */
export const SEUIL_FIABLE = 3;

// Le score d'un votant (pur) vit dans le moteur ; on le ré-exporte pour les écrans.
export { scoreVotant };
export type { ProximiteScore };

/** Contexte du « je » : réponses + poids + questions jouées + classement par groupe pré-calculé. */
export interface ContexteJe {
  reponses: Record<number, Reponse>;
  poids: Record<string, number>;
  questions: QuestionProximite[]; // uniquement les questions répondues
  resultat: ResultatProximite;
  comparableParGroupe: Record<string, number>;
  nbVotes: number; // nb de réponses pour/contre (les « sans avis » ne comptent pas)
}

// --- Chargement du contexte (mémoïsé par horodatage du test) ----------------------
let cacheP: Promise<ContexteJe | null> | null = null;
let cacheTs: number | null = null;

/**
 * Charge (et mémoïse) le contexte du « je ». Le cache se ré-invalide tout seul quand un
 * nouveau test est enregistré (l'horodatage `ts` change). Renvoie null si aucun test fait.
 */
export function chargerJe(): Promise<ContexteJe | null> {
  const etat = chargerTest();
  if (!etat || !Object.keys(etat.reponses).length) {
    cacheP = null;
    cacheTs = null;
    return Promise.resolve(null);
  }
  const ts = etat.ts ?? 0;
  if (cacheP && cacheTs === ts) return cacheP;
  cacheTs = ts;
  cacheP = Promise.all([getTestProximite(), getPartis()]).then(([toutes, partis]) => {
    const jouees = toutes.filter((q) => etat.reponses[q.id] != null);
    const groupes = partis.filter((p) => p.abrev).map((p) => ({ abrev: p.abrev! }));
    const poids = etat.poids ?? {};
    const resultat = calculerProximite(jouees, etat.reponses, poids, groupes);
    const comparableParGroupe: Record<string, number> = {};
    for (const parGroupe of Object.values(resultat.parTheme))
      for (const [abrev, sc] of Object.entries(parGroupe))
        comparableParGroupe[abrev] = (comparableParGroupe[abrev] ?? 0) + sc.comparable;
    const nbVotes = Object.values(etat.reponses).filter((r) => r === "pour" || r === "contre").length;
    return { reponses: etat.reponses, poids, questions: jouees, resultat, comparableParGroupe, nbVotes };
  });
  return cacheP;
}

/** Proximité au « je » d'un GROUPE (par abrev). null si pas de test ou rien de comparable. */
export function scoreGroupeJe(ctx: ContexteJe | null, abrev: string | null | undefined): ProximiteScore | null {
  if (!ctx || !abrev) return null;
  const g = ctx.resultat.global.find((x) => x.abrev === abrev);
  const comparable = ctx.comparableParGroupe[abrev] ?? 0;
  if (!g || comparable < 1) return null;
  return { pct: g.pct, comparable };
}

// --- Hooks React ------------------------------------------------------------------

/** Contexte du « je » (null tant qu'il charge OU si aucun test fait). */
export function useJe(): ContexteJe | null {
  const [ctx, setCtx] = useState<ContexteJe | null>(null);
  useEffect(() => {
    let vivant = true;
    chargerJe().then((c) => vivant && setCtx(c));
    return () => {
      vivant = false;
    };
  }, []);
  return ctx;
}

/** Proximité au « je » d'un DÉPUTÉ (charge ses votes bruts). null sans test / non comparable. */
export function useProximiteDepute(uid: string): ProximiteScore | null {
  const ctx = useJe();
  const [score, setScore] = useState<ProximiteScore | null>(null);
  useEffect(() => {
    if (!ctx) {
      setScore(null);
      return;
    }
    let vivant = true;
    getVotesBruts(uid)
      .then((votes) => {
        if (vivant) setScore(scoreVotant(ctx.questions, ctx.reponses, ctx.poids, votes));
      })
      .catch(() => vivant && setScore(null));
    return () => {
      vivant = false;
    };
  }, [ctx, uid]);
  return score;
}
