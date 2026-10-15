// Base des « % comme toi » des fiches député et parti — LOGIQUE PURE (aucun import RN),
// testée hors app (`baseAccord.test.ts`, garde de refresh.yml). Ne recode PAS le score : le
// pourcentage reste celui du moteur (`calculerProximite`, moyenne des thèmes pondérée par
// l'importance donnée) ; ce module dit SUR QUOI il repose (combien de scrutins comparés,
// combien comme toi) et ventile par thème avec le seuil de fiabilité. Tout reste sur
// l'appareil : rien n'est envoyé.

import { SEUIL_FIABILITE } from "../config";
import { calculerProximite, scrutinUidDeId, type QuestionProximite, type Reponse, type PositionGroupe, type ResultatProximite } from "./score";

const tranche = (p: unknown): p is "pour" | "contre" => p === "pour" || p === "contre";

/** Scrutins comparés (tranchés par toi ET par l'élu ou le groupe), dont comme toi / à l'inverse. */
export interface BaseAccord {
  comparable: number;
  accord: number;
  inverse: number;
}

/** Base avec un VOTANT (député) : ses votes individuels { scrutin_uid: position }. */
export function baseAccordVotant(
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  votes: Record<string, string>
): BaseAccord {
  let comparable = 0;
  let accord = 0;
  for (const q of questions) {
    const r = reponses[q.id];
    const v = votes[scrutinUidDeId(q.id)];
    if (!tranche(r) || !tranche(v)) continue;
    comparable++;
    if (r === v) accord++;
  }
  return { comparable, accord, inverse: comparable - accord };
}

/** Base avec un GROUPE, relue dans le résultat du moteur (comparables et accords par thème). */
export function baseAccordGroupe(res: ResultatProximite, abrev: string): BaseAccord {
  let comparable = 0;
  let accord = 0;
  for (const parGroupe of Object.values(res.parTheme)) {
    const sc = parGroupe[abrev];
    if (!sc || !sc.comparable || sc.pct == null) continue;
    comparable += sc.comparable;
    accord += Math.round(sc.pct * sc.comparable);
  }
  return { comparable, accord, inverse: comparable - accord };
}

/** Clé du « groupe virtuel » qui porte les votes d'un député dans le moteur. */
export const CLE_VOTANT = "__moi";

/** Résultat du moteur pour un VOTANT seul (mêmes règles que les groupes : abstention, absence → non comparable). */
export function resultatVotant(
  questions: QuestionProximite[],
  reponses: Record<number, Reponse>,
  poids: Record<string, number>,
  votes: Record<string, string>
): ResultatProximite {
  const qs = questions.map((q) => {
    const v = votes[scrutinUidDeId(q.id)];
    const pos: PositionGroupe = tranche(v) ? v : "abstention";
    return { ...q, positions: { [CLE_VOTANT]: pos } };
  });
  return calculerProximite(qs, reponses, poids, [{ abrev: CLE_VOTANT }]);
}

/** Accord par thème : `pct` (0..1) et nombre de votes comparés ; `fiable` = au moins `seuil` votes. */
export interface AccordTheme {
  id: string;
  pct: number;
  comparable: number;
  fiable: boolean;
}

/**
 * Lignes d'accord par thème pour une clé (abrev de groupe ou CLE_VOTANT). Thèmes fiables d'abord,
 * du plus d'accord au moins ; puis ceux sous le seuil (on ne conclut pas), base décroissante.
 * Un thème sans aucun vote comparé n'apparaît pas.
 */
export function accordsParTheme(res: ResultatProximite, cle: string, seuil: number = SEUIL_FIABILITE): AccordTheme[] {
  const out: AccordTheme[] = [];
  for (const [id, parCle] of Object.entries(res.parTheme)) {
    const sc = parCle[cle];
    if (!sc || sc.pct == null || sc.comparable < 1) continue;
    out.push({ id, pct: sc.pct, comparable: sc.comparable, fiable: sc.comparable >= seuil });
  }
  return out.sort(
    (a, b) => Number(b.fiable) - Number(a.fiable) || (a.fiable ? b.pct - a.pct : b.comparable - a.comparable) || a.id.localeCompare(b.id)
  );
}

/**
 * Le % du moteur fait la moyenne des thèmes (chacun selon l'importance que tu lui donnes) :
 * il peut s'écarter du simple « comme toi / comparés ». Vrai quand l'écart se voit à l'arrondi.
 */
export function pctPondereDiffere(pct: number, base: BaseAccord): boolean {
  if (base.comparable < 1) return false;
  return Math.round(pct * 100) !== Math.round((base.accord / base.comparable) * 100);
}

/** Verdict d'UN vote : « comme » / « inverse » si toi et l'élu avez tranché (pour/contre), sinon null. */
export function verdictVote(reponse: Reponse | undefined, position: string | null | undefined): "comme" | "inverse" | null {
  if (!tranche(reponse) || !tranche(position)) return null;
  return reponse === position ? "comme" : "inverse";
}
