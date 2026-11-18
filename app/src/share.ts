// Partage d'un lien : navigator.share natif si dispo (feuille de partage système), sinon copie
// presse-papier, sinon échec silencieux. Une seule implémentation pour toute l'appli (scrutin,
// élu, groupe, résultat du test, rubrique Présidentielle). Le verdict « comme toi » N'entre
// JAMAIS dans le partage — il reste local et privé.
//
// Mesure : chaque partage envoie `track("share", quoi, issue)`, deux valeurs de listes fermées
// (mesureListes.ts) : ce qui est partagé (son type, jamais son contenu) et si c'est parti.
// Les liens partagés portent `via=partage` : la visite qu'ils amènent est comptée comme telle
// (arrivee.ts). Les anciens liens, sans ce paramètre, restent valides.

import { track } from "./analytics";
import type { QuoiPartage } from "./mesureListes";
import { valeurOpen, type CibleLien } from "./presidentielle/logique";

export type ResultatPartage = "shared" | "copied" | "cancelled" | "manual";

/** Marque d'un lien partagé (retirée de l'adresse à l'arrivée, cf. arrivee.ts). */
export const VIA_PARTAGE = "via=partage";

async function tenterPartage(url: string, texte: string, titre: string): Promise<ResultatPartage> {
  try {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.share) {
      await nav.share({ title: titre, text: texte, url });
      return "shared";
    }
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(`${texte}\n${url}`);
      return "copied";
    }
  } catch (e: any) {
    // L'utilisateur a fermé la feuille de partage : rien à signaler.
    if (e?.name === "AbortError") return "cancelled";
    /* indisponible → repli manuel */
  }
  return "manual";
}

/**
 * Partage `url` + `texte`. `quoi` (obligatoire) dit ce qui est partagé, pour la mesure.
 * « cancelled » = feuille fermée : l'appelant n'affiche alors aucun message.
 */
export async function partagerLien(quoi: QuoiPartage, url: string, texte: string, titre = "Scrutoir"): Promise<ResultatPartage> {
  const r = await tenterPartage(url, texte, titre);
  track("share", quoi, r);
  return r;
}

const origine = () =>
  typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";

/** Lien public d'un scrutin sur scrutoir.fr (page ouverte via le deep-link `?open=scrutin:uid`). */
export function urlScrutin(uid: string): string {
  return `${origine()}/?open=scrutin:${uid}&${VIA_PARTAGE}`;
}

/** Lien public de la fiche d'un député (`?open=depute:uid`). */
export function urlDepute(uid: string): string {
  return `${origine()}/?open=depute:${uid}&${VIA_PARTAGE}`;
}

/** Lien public de la fiche d'un groupe (`?open=parti:uid`). */
export function urlParti(uid: string): string {
  return `${origine()}/?open=parti:${uid}&${VIA_PARTAGE}`;
}

/** Lien public d'un écran de la rubrique Présidentielle 2027 (`?open=presidentielle`,
 *  `programme:<id>`, `chapitre:<id>.<chapitre>`, `mesure:<id>.<mesure ou code du chiffrage>`). */
export function urlRubrique(c: CibleLien): string {
  return `${origine()}/?open=${valeurOpen(c)}&${VIA_PARTAGE}`;
}
