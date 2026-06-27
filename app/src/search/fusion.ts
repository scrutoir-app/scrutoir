/**
 * Fusion recherche EXACTE (prioritaire) + SÉMANTIQUE (« Sujet », en plus).
 *
 * - La recherche exacte (lexicale, sur le titre + élus/partis) reste la référence.
 * - La recherche sémantique alimente une section « Sujet » SÉPARÉE : scrutins liés au
 *   thème même sans le mot exact (« droits LGBT » → thérapies de conversion).
 * - DÉDUP par DOSSIER : un même texte génère des dizaines d'amendements/articles → on
 *   n'en garde qu'UN par dossier, en privilégiant le vote sur le TEXTE ENTIER (« l'ensemble »)
 *   et la lecture la plus récente. On exclut aussi les dossiers déjà montrés en exact.
 * - REPLI LEXICAL : si le modèle/index est indisponible (hors-ligne au 1er usage, erreur),
 *   on renvoie quand même les résultats exacts (semantiqueDispo = false).
 */
import { rechercher, getScrutinsParUids } from "../api";
import type { DeputeResume, ScrutinResume } from "../types";
import { rechercheSemantique } from "./engine";
import { routerIntention } from "./intent";
import { aplatir } from "./normalize";

// Plancher de pertinence pour AFFICHER la section « Sujet » (cosinus tassés → calibré
// empiriquement : pertinents ≥ 0,85, hors-sujet ≤ 0,845). Contourné si un alias est
// reconnu (signal topique fort). ⚠️ à re-tuner avec l'usage réel.
const SEUIL_SUJET = 0.85;
const MAX_SUJET = 8;

export interface ResultatsRecherche {
  deputes: DeputeResume[];
  scrutins: ScrutinResume[]; // exact, dédupliqués par dossier
  sujet: ScrutinResume[]; // sémantique, dédup dossier, hors dossiers exacts
  semantiqueDispo: boolean; // false = repli lexical (modèle indispo)
}

/** Clé de dossier dérivée du titre (l'index n'a pas d'id de dossier). Les amendements/
 *  articles/ensemble d'un même texte partagent « proposition/projet de loi … ». On retire
 *  les parenthèses (lecture, n°…) pour fusionner les lectures successives. */
export function cleDossier(titre: string | null | undefined): string {
  const sansParen = (titre || "").replace(/\([^)]*\)/g, " ");
  const plat = aplatir(sansParen); // « … proposition de loi relative a … », encadré d'espaces
  const m = plat.match(/ (?:proposition|projet) de loi .*/);
  return (m ? m[0] : plat).replace(/\s+/g, " ").trim();
}

/** Vote sur le texte entier (« l'ensemble … ») — le plus représentatif d'un dossier. */
function estEnsemble(titre: string | null | undefined): boolean {
  return aplatir(titre || "").startsWith(" l ensemble ");
}

/** a est-il un meilleur représentant de dossier que b ? (texte entier, puis plus récent) */
function meilleur(a: ScrutinResume, b: ScrutinResume): boolean {
  const ea = estEnsemble(a.titre);
  const eb = estEnsemble(b.titre);
  if (ea !== eb) return ea;
  return (a.date || "") > (b.date || "");
}

/** Dédup par dossier en préservant l'ordre d'entrée (= ordre de pertinence), et en
 *  remplaçant le représentant d'un groupe par le meilleur (ensemble / plus récent). */
export function dedupParDossier(list: ScrutinResume[]): ScrutinResume[] {
  const choix = new Map<string, ScrutinResume>();
  const ordre: string[] = [];
  for (const s of list) {
    const k = cleDossier(s.titre);
    const prev = choix.get(k);
    if (!prev) {
      choix.set(k, s);
      ordre.push(k);
    } else if (meilleur(s, prev)) {
      choix.set(k, s);
    }
  }
  return ordre.map((k) => choix.get(k)!);
}

/**
 * Phase « Sujet » SEULE (sémantique), à appeler APRÈS l'exact pour un rendu en deux temps
 * (l'exact reste instantané, le Sujet s'ajoute quand le modèle a répondu). `exactScrutins`
 * = scrutins exacts bruts (avant dédup) pour exclure leurs uids/dossiers de la section Sujet.
 */
export async function rechercherSujet(
  q: string,
  exactScrutins: ScrutinResume[]
): Promise<{ sujet: ScrutinResume[]; semantiqueDispo: boolean }> {
  const intent = routerIntention(q);
  // Sémantique seulement pour les requêtes « sujet » (pas un n° de scrutin ni un parti exact).
  if (intent.type !== "sujet") return { sujet: [], semantiqueDispo: false };
  try {
    const sem = await rechercheSemantique(q); // classés par cosinus décroissant
    const pertinent = sem.length > 0 && (sem[0].score >= SEUIL_SUJET || intent.correspondances.length > 0);
    if (!pertinent) return { sujet: [], semantiqueDispo: true };
    const uidsExacts = new Set(exactScrutins.map((s) => s.uid));
    const dossiersExacts = new Set(exactScrutins.map((s) => cleDossier(s.titre)));
    const resolus = await getScrutinsParUids(sem.map((r) => r.uid)); // ordre = pertinence
    const sujet = dedupParDossier(resolus.filter((s) => !uidsExacts.has(s.uid)))
      .filter((s) => !dossiersExacts.has(cleDossier(s.titre)))
      .slice(0, MAX_SUJET);
    return { sujet, semantiqueDispo: true };
  } catch {
    return { sujet: [], semantiqueDispo: false }; // repli lexical : on garde l'exact
  }
}

/** Recherche complète exact + Sujet en un appel (tests / usage non incrémental). */
export async function rechercherTout(q: string): Promise<ResultatsRecherche> {
  const exact = await rechercher(q);
  const scrutins = dedupParDossier(exact.scrutins);
  const { sujet, semantiqueDispo } = await rechercherSujet(q, exact.scrutins);
  return { deputes: exact.deputes, scrutins, sujet, semantiqueDispo };
}
