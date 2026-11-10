// FOCUS DE LA SEMAINE (accueil) : choisi par les données, jamais à la main. Fonction pure,
// testée par `focusSemaine.test.ts`, partagée par l'app (bloc focus de l'accueil) et par le
// pipeline (`data/hebdo.json`, lu par le post Instagram du lundi) : les deux montrent le même vote.
//
// RÈGLE (unique et publique, rappelée sous le bloc) :
// - Fenêtre : celle de l'édition « La semaine à l'Assemblée » du vendredi `v` (`fenetre(v)`,
//   hebdo.ts : du vendredi J-7 au jeudi J-1). Aucune autre définition de la semaine.
// - Candidats : tous les scrutins publics de l'Assemblée de la fenêtre, quel que soit leur type
//   (solennel, ordinaire, motion, article, amendement, ensemble). Aucune exclusion.
// - Votants = pour + contre + abstention. (Vérifié le 10/11/2026 sur les 9 793 scrutins de
//   l'archive AN : égal au `nombreVotants` officiel dans 100 % des cas.)
// - Choix : le plus de votants. Égalité : la date la plus récente, puis le numéro le plus élevé.
// - Semaine sans scrutin public : le focus de la dernière édition qui en a eu, signalé (`repli`).
// - Aucun forçage, aucune exception. Le contenu éditorial (content/focus.ts, `focusEditorial`)
//   s'ajoute au bloc mais n'entre jamais dans le choix.

import { dansLaFenetre, editionDuScrutin, fenetre, type ScrutinSrc } from "./hebdo";

export type ScrutinCandidat = Pick<ScrutinSrc, "uid" | "numero" | "date" | "pour" | "contre" | "abstention">;

export interface FocusSemaine<S extends ScrutinCandidat = ScrutinCandidat> {
  scrutin: S;
  votants: number;
  /** Vendredi de l'édition demandée. */
  vendredi: string;
  /** Vendredi de l'édition d'où vient le scrutin : le même, sauf repli. */
  vendrediSource: string;
  /** true : aucun scrutin public dans la fenêtre demandée, focus repris de la dernière édition qui en a eu. */
  repli: boolean;
}

export const votants = (s: Pick<ScrutinSrc, "pour" | "contre" | "abstention">): number => (s.pour ?? 0) + (s.contre ?? 0) + (s.abstention ?? 0);

/** > 0 si `a` passe devant `b` : plus de votants, puis plus récent, puis numéro plus élevé. */
function compare(a: ScrutinCandidat, b: ScrutinCandidat): number {
  return votants(a) - votants(b) || (a.date ?? "").localeCompare(b.date ?? "") || (a.numero ?? 0) - (b.numero ?? 0);
}

function meilleur<S extends ScrutinCandidat>(scrutins: S[], vendredi: string): S | null {
  let choisi: S | null = null;
  for (const s of dansLaFenetre(vendredi, scrutins)) if (!choisi || compare(s, choisi) > 0) choisi = s;
  return choisi;
}

/** Focus de l'édition du vendredi `vendredi`, ou null si aucun scrutin public n'a encore eu lieu. */
export function focusDeLaSemaine<S extends ScrutinCandidat>(scrutins: S[], vendredi: string): FocusSemaine<S> | null {
  const direct = meilleur(scrutins, vendredi);
  if (direct) return { scrutin: direct, votants: votants(direct), vendredi, vendrediSource: vendredi, repli: false };
  // Semaine vide : on remonte à l'édition du dernier scrutin public antérieur à la fenêtre.
  const { debut } = fenetre(vendredi);
  let derniere = "";
  for (const s of scrutins) if (s.date && s.date < debut && s.date > derniere) derniere = s.date;
  if (!derniere) return null;
  const source = editionDuScrutin(derniere);
  const repris = meilleur(scrutins, source);
  return repris ? { scrutin: repris, votants: votants(repris), vendredi, vendrediSource: source, repli: true } : null;
}

/** Ce que publient les données de l'édition (`data/hebdo.json`) pour le post Instagram. */
export interface FocusSemainePublie {
  uid: string;
  numero: number | null;
  votants: number;
}

export const focusPublie = (f: FocusSemaine): FocusSemainePublie => ({ uid: f.scrutin.uid, numero: f.scrutin.numero, votants: f.votants });
