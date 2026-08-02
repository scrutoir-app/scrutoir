// Partage d'un lien — même mécanisme que « Partager mon résultat » (TestResultatScreen) :
// navigator.share natif si dispo (feuille de partage système), sinon copie presse-papier,
// sinon échec silencieux. Aucune donnée privée : ici on ne partage QUE le vote public d'un
// scrutin (lien scrutoir.fr + titre + résultat). Le verdict « comme toi » N'entre JAMAIS
// dans le partage — il reste local et privé.

export type ResultatPartage = "shared" | "copied" | "manual";

export async function partagerLien(url: string, texte: string, titre = "Scrutoir"): Promise<ResultatPartage> {
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
  } catch {
    /* annulé / indisponible → repli manuel */
  }
  return "manual";
}

/** Lien public d'un scrutin sur scrutoir.fr (page ouverte via le deep-link `?open=scrutin:uid`). */
export function urlScrutin(uid: string): string {
  const origin =
    typeof window !== "undefined" && window.location ? window.location.origin : "https://scrutoir.fr";
  return `${origin}/?open=scrutin:${uid}`;
}
