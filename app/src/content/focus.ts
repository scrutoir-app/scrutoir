import type { FocusDef } from "../hebdo";

/**
 * FOCUS ACTUALITÉ de l'accueil — fichier ÉDITÉ À LA MAIN (pas de flux tiers dans l'app).
 *
 * - Le choix du SUJET est éditorial et assumé : il est écrit sous le focus (`critere`).
 * - Le choix des TEXTES est mécanique : `motsCles` est appliqué aux intitulés (dossier + texte
 *   cité dans les scrutins) par `textesFocus` (hebdo.ts). `critere` doit décrire EXACTEMENT
 *   `motsCles`, sinon ce qui est affiché ment.
 * - `aSuivre` est une phrase factuelle figée : la relire à chaque mise à jour des données.
 * - Hors de la période `du`…`au` (dates ISO, incluses), le focus disparaît de l'accueil.
 *   Pas de focus : `FOCUS = null`.
 * Mots-clés : bornes de mot écrites à la main ([^\wÀ-ÿ]) car \b ignore les lettres accentuées.
 */
export interface FocusActu extends FocusDef {
  id: string;
  du: string;
  au: string;
  titre: string;
  contexte: string;
  critere: string;
  aSuivre?: string;
  /** Thème dont la teinte marque le focus (categoryUI), facultatif. */
  categorie?: string;
}

export const FOCUS: FocusActu | null = {
  id: "loi-integrale-vss-2026",
  du: "2026-10-13",
  au: "2026-11-15",
  categorie: "securite-justice",
  titre: "Loi intégrale contre les violences sexuelles : ce que l'Assemblée a voté",
  contexte:
    "Un texte transpartisan qui touche à la police, la justice, l'école, la santé et le travail, examiné avec une loi organique sur l'autorité judiciaire. Adopté en première lecture le 13 octobre par 503 voix pour, 0 contre et 67 abstentions : tous les groupes ont voté pour, sauf La France insoumise, qui s'est abstenue. Le congé pour les salariés victimes, rejeté le 9 octobre (77 voix contre 74), a été rétabli le 13 en seconde délibération.",
  motsCles: /réponse intégrale au phénomène des violences sexuelles|autorité judiciaire à la lutte contre les violences sexuelles/i,
  critere:
    "Sujet choisi par Scrutoir d'après l'actualité. Textes retenus : ceux dont l'intitulé mentionne une réponse intégrale aux violences sexuelles et sexistes, ou l'adaptation de l'autorité judiciaire à la lutte contre les violences sexuelles (la loi organique examinée avec elle).",
  aSuivre:
    "Le texte part au Sénat, en procédure accélérée ; aucune date d'examen n'est fixée. Si les sénateurs le modifient, une commission mixte paritaire cherchera un texte commun, que l'Assemblée votera à nouveau.",
};
