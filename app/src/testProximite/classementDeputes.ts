// Classement des DÉPUTÉS par affinité au « je » — pour le deck au swipe de « Trouver un
// député ». RÉUTILISE EXACTEMENT le moteur des fiches (`scoreVotant` / `calculerProximite`,
// même pondération par thème, mêmes règles de comparabilité) : aucun calcul parallèle.
//
// Coût borné par le nombre de scrutins RÉPONDUS (≤ 39), jamais par le nombre de députés :
// pour chaque scrutin du test, on lit ses `votants` (position par député) et on pivote en
// { député → { scrutin → position } }, puis on score chaque député. 100 % client, rien n'est
// envoyé au serveur, aucun compteur.

import { useEffect, useState } from "react";
import { getScrutinVotantsRaw, getPartis, deputesIndexPublic } from "../api";
import {
  scoreVotant,
  scrutinUidDeId,
  type ProximiteScore,
  type Reponse,
} from "./score";
import { SEUIL_FIABLE, type ContexteJe } from "./jeProximite";
import type { DeputeResume } from "../types";

/** Un vote en commun entre l'utilisateur et le député (pour la justification de la carte). */
export interface VoteCommun {
  theme: string;
  these: string;
  position: "pour" | "contre"; // position partagée (les deux ont voté pareil)
}

/** Un député classé par affinité, avec sa justification. */
export interface DeputeAffinite {
  resume: DeputeResume; // uid, nom, photo, abrev, groupe, couleur, circo, departement…
  groupe_uid: string | null;
  score: ProximiteScore; // pct + comparable (base de scrutins comparés)
  communs: VoteCommun[]; // scrutins où vous avez voté pareil (pour « vous avez voté pareil »)
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
  const [deps, partis] = await Promise.all([deputesIndexPublic(), getPartis()]);
  const circoParUid = new Map(deps.map((d) => [d.uid, d]));
  const couleurParGroupeUid = new Map(partis.map((p) => [p.uid, p.couleur]));

  // Pivot : { uid → { scrutin_uid → position } } + dernier résumé vu pour chaque député.
  const votesParDep = new Map<string, Record<string, string>>();
  const resumeParDep = new Map<string, { r: DeputeResume; groupe_uid: string | null }>();

  // Un fetch par scrutin RÉPONDU (borné par ctx.questions) ; les fichiers manquants sont
  // simplement sautés (certains scrutins du test n'ont pas de fichier votants côté data).
  await Promise.all(
    ctx.questions.map(async (q) => {
      const su = scrutinUidDeId(q.id);
      let parPos: Record<string, any[]>;
      try {
        parPos = await getScrutinVotantsRaw(su);
      } catch {
        return;
      }
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

    // Votes en commun : réponse tranchée ET vote du député identique. On garde jusqu'à 3
    // (les plus « parlants » = ceux avec une thèse), pour la justification de la carte.
    const communs: VoteCommun[] = [];
    for (const q of ctx.questions) {
      const rep = ctx.reponses[q.id];
      if (!est(rep)) continue;
      const v = votes[scrutinUidDeId(q.id)];
      if (v === rep && q.these) communs.push({ theme: q.theme, these: q.these, position: rep });
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
      communs: communs.slice(0, 3),
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
