// Affinité des DÉPUTÉS au « je » — vivier du deck au swipe de « Trouver un député » (le deck
// n'en consomme qu'un LOT QUOTIDIEN tiré au hasard, cf. `selectionDuJour.ts` ; le classement
// ne sert plus qu'à stratifier ce tirage pour qu'un lot mêle profils proches et éloignés). RÉUTILISE EXACTEMENT le moteur des fiches (`scoreVotant` / `calculerProximite`,
// même pondération par thème, mêmes règles de comparabilité) : aucun calcul parallèle.
//
// Coût borné par le nombre de scrutins du test (39), jamais par le nombre de députés : pour
// chaque scrutin du test, on lit ses `votants` (position par député) et on pivote en
// { député → { scrutin → position } }, puis on score chaque député. 100 % client, rien n'est
// envoyé au serveur, aucun compteur. On télécharge les fichiers de TOUTES les questions,
// répondues ou non (~10 Ko compressés chacun, puis en cache) : la liste des fichiers demandés
// ne dit donc rien de tes réponses, ni même des questions que tu as tranchées.

import { useEffect, useState } from "react";
import { getScrutinVotantsRaw, getPartis, deputesIndexPublic, getTestProximite } from "../api";
import {
  scoreVotant,
  scrutinUidDeId,
  type ProximiteScore,
  type Reponse,
} from "./score";
import { SEUIL_FIABLE, type ContexteJe } from "./jeProximite";
import type { DeputeResume } from "../types";

/**
 * Un scrutin COMPARÉ : tu l'as tranché et le député aussi (pour ou contre). Sert au détail de la
 * carte (« Voir vos votes et sa fiche ») : « Vous deux : Pour » ou « Toi : Pour · son vote : Contre ».
 */
export interface VoteCompare {
  theme: string;
  texte: string; // résumé « en clair » du test, à défaut l'intitulé officiel
  toi: "pour" | "contre";
  sonVote: "pour" | "contre";
}

/** Un député classé par affinité, avec sa justification. */
export interface DeputeAffinite {
  resume: DeputeResume; // uid, nom, photo, abrev, groupe, couleur, circo, departement…
  groupe_uid: string | null;
  score: ProximiteScore; // pct (moteur, pondéré par thème) + comparable (base de scrutins comparés)
  accord: number; // scrutins comparés où vous avez voté pareil (« 5 votes sur 7 comparés »)
  compares: VoteCompare[]; // tous les scrutins comparés, dans l'ordre du test
}

const est = (p: string | undefined): p is "pour" | "contre" => p === "pour" || p === "contre";

/**
 * Classe TOUS les députés votants du plus proche au moins proche de l'utilisateur.
 * `min` = base minimale de scrutins comparés pour être classé (défaut : seuil de fiabilité).
 */
export async function classerDeputesAffinite(
  ctx: ContexteJe,
  min: number = SEUIL_FIABLE
): Promise<DeputeAffinite[]> {
  // Index léger : circo / département (absents des votants d'un scrutin) + roster de secours.
  const [deps, partis, toutes] = await Promise.all([deputesIndexPublic(), getPartis(), getTestProximite()]);
  const repondus = new Set(ctx.questions.map((q) => scrutinUidDeId(q.id)));
  const circoParUid = new Map(deps.map((d) => [d.uid, d]));
  const couleurParGroupeUid = new Map(partis.map((p) => [p.uid, p.couleur]));

  // Pivot : { uid → { scrutin_uid → position } } + dernier résumé vu pour chaque député.
  const votesParDep = new Map<string, Record<string, string>>();
  const resumeParDep = new Map<string, { r: DeputeResume; groupe_uid: string | null }>();

  // Un fetch par scrutin DU TEST, dans l'ordre du test, répondu ou non (cf. en-tête) ; seuls les
  // répondus sont pivotés. Les fichiers manquants sont simplement sautés (certains scrutins du
  // test n'ont pas de fichier votants côté data).
  await Promise.all(
    toutes.map(async (q) => {
      const su = scrutinUidDeId(q.id);
      let parPos: Record<string, any[]>;
      try {
        parPos = await getScrutinVotantsRaw(su);
      } catch {
        return;
      }
      if (!repondus.has(su)) return;
      for (const [position, votants] of Object.entries(parPos)) {
        if (!Array.isArray(votants)) continue;
        for (const v of votants) {
          if (!v?.uid) continue;
          const m = votesParDep.get(v.uid) ?? {};
          m[su] = position;
          votesParDep.set(v.uid, m);
          if (!resumeParDep.has(v.uid)) {
            resumeParDep.set(v.uid, {
              r: {
                uid: v.uid,
                nom_complet: v.nom_complet,
                groupe: v.groupe ?? null,
                groupe_uid: v.groupe_uid ?? null,
                abrev: v.abrev ?? null,
                couleur: v.couleur ?? couleurParGroupeUid.get(v.groupe_uid) ?? null,
                photo_url: v.photo_url ?? null,
              },
              groupe_uid: v.groupe_uid ?? null,
            });
          }
        }
      }
    })
  );

  const out: DeputeAffinite[] = [];
  for (const [uid, votes] of votesParDep) {
    const score = scoreVotant(ctx.questions, ctx.reponses, ctx.poids, votes);
    if (!score || score.comparable < min) continue;

    // Détail de la carte : tous les scrutins que vous avez tranchés tous les deux (mêmes règles
    // de comparabilité que le moteur : `score.comparable` = compares.length).
    const compares: VoteCompare[] = [];
    for (const q of ctx.questions) {
      const rep = ctx.reponses[q.id];
      const v = votes[scrutinUidDeId(q.id)];
      if (!est(rep) || !est(v)) continue;
      compares.push({ theme: q.theme, texte: q.these || q.titre || `Scrutin n° ${q.id}`, toi: rep, sonVote: v });
    }

    const base = resumeParDep.get(uid)!;
    const idx = circoParUid.get(uid);
    out.push({
      resume: {
        ...base.r,
        circo: idx?.circo ?? null,
        departement: idx?.departement ?? null,
        num_departement: idx?.num_departement ?? null,
      },
      groupe_uid: base.groupe_uid,
      score,
      accord: compares.filter((c) => c.toi === c.sonVote).length,
      compares,
    });
  }

  // Classement : proximité décroissante, puis base la plus large, puis nom (stable).
  out.sort(
    (a, b) =>
      b.score.pct - a.score.pct ||
      b.score.comparable - a.score.comparable ||
      a.resume.nom_complet.localeCompare(b.resume.nom_complet, "fr")
  );
  return out;
}

/** Hook React : classement d'affinité (null tant qu'il charge ou sans « je »). */
export function useClassementAffinite(ctx: ContexteJe | null): DeputeAffinite[] | null {
  const [rang, setRang] = useState<DeputeAffinite[] | null>(null);
  useEffect(() => {
    if (!ctx) {
      setRang(null);
      return;
    }
    let vivant = true;
    classerDeputesAffinite(ctx)
      .then((r) => vivant && setRang(r))
      .catch(() => vivant && setRang([]));
    return () => {
      vivant = false;
    };
  }, [ctx]);
  return rang;
}
