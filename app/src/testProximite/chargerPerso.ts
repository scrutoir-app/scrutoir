// Chargement des questions HORS TEST (scrutins tranchés depuis le tiroir de vote) : lit le cache
// local, reconstruit au besoin une entrée manquante depuis le détail publié du scrutin (fichiers
// statiques déjà en cache), puis répartit (questionsPerso.ts, pur et testé). Rien n'est envoyé.

import { getDossiers, getScrutin } from "../api";
import type { DetailScrutin, DossierResume } from "../types";
import { ecrireCachePerso, lireCachePerso, type Origine } from "./storage";
import { questionPerso, repartirPerso, type EntreePerso, type RepartitionPerso } from "./questionsPerso";
import { scrutinUidDeId, type Reponse } from "./score";

/** Entrée de cache d'un scrutin, depuis son détail publié (thème : celui du dossier d'abord). */
export function entreeDepuisDetail(d: DetailScrutin, dossiers: DossierResume[]): EntreePerso | null {
  const s = d.scrutin;
  if (s.numero == null) return null;
  const themeDossier = s.dossier_ref ? dossiers.find((x) => x.ref === s.dossier_ref)?.categorie ?? null : null;
  return questionPerso(
    {
      numero: s.numero,
      titre: s.titre,
      type_vote: s.type_vote,
      dossier_titre: s.dossier_titre,
      date: s.date,
      categorie: s.categorie ?? null,
      totaux: { pour: s.pour, contre: s.contre, abstention: s.abstention },
      groupes: d.groupes,
    },
    themeDossier,
  );
}

/** Garde la question hors test d'un scrutin qu'on vient de trancher (détail en cache). */
export async function memoriserQuestionPerso(uid: string): Promise<void> {
  const [d, dossiers] = await Promise.all([getScrutin(uid), getDossiers().catch(() => [] as DossierResume[])]);
  const e = entreeDepuisDetail(d, dossiers);
  if (e) ecrireCachePerso(e.q.id, e);
}

/**
 * Questions hors test d'un jeu de réponses (les tiennes, ou celles d'un lien partagé) : les
 * entrées absentes du cache sont reconstruites depuis le détail du scrutin. `garder` : les
 * mettre en cache (jamais pour un lien partagé, qui n'est pas à toi).
 */
export async function chargerPerso(
  reponses: Record<number, Reponse>,
  origines: Record<number, Origine> | undefined,
  idsTest: ReadonlySet<number>,
  garder = true,
): Promise<RepartitionPerso> {
  const cache = (garder ? lireCachePerso() : {}) as Record<string, EntreePerso | undefined>;
  const premier = repartirPerso(reponses, origines, idsTest, cache);
  if (!premier.manquants.length) return premier;
  const dossiers = await getDossiers().catch(() => [] as DossierResume[]);
  const complete = { ...cache };
  await Promise.all(
    premier.manquants.map(async (n) => {
      try {
        const e = entreeDepuisDetail(await getScrutin(scrutinUidDeId(n)), dossiers);
        if (!e) return;
        complete[n] = e;
        if (garder) ecrireCachePerso(n, e);
      } catch { /* scrutin introuvable : la réponse reste notée, hors calcul */ }
    }),
  );
  const r = repartirPerso(reponses, origines, idsTest, complete);
  return { ...r, manquants: [] };
}
