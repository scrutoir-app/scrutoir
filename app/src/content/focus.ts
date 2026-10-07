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
  id: "mobilisation-lyceenne-2026",
  du: "2026-10-01",
  au: "2026-10-31",
  categorie: "education",
  titre: "Lycéens et étudiants mobilisés : ce que l'Assemblée a voté",
  contexte: "Conditions d'étude, personnels, inclusion, vie étudiante : les textes votés en scrutin public sur ces sujets depuis 2024.",
  motsCles: /(^|[^\wÀ-ÿ])(écoles?|scolaires?|élèves?|étudiant(e|s|es)?|enseignants?|lycé(e|es|en|ens|enne|ennes)|parcoursup)(?=[^\wÀ-ÿ]|$)/i,
  critere:
    "Sujet choisi par Scrutoir d'après l'actualité. Textes retenus : ceux dont l'intitulé mentionne l'école, la scolarité (scolaire), les élèves, les lycées, les étudiants, les enseignants ou Parcoursup.",
  aSuivre:
    "Aucun texte consacré à Parcoursup ni au nombre de postes d'enseignants n'a été voté en scrutin public depuis 2024. Les postes se décident dans le budget de l'État : le vote du budget 2027 sera à suivre ici.",
};
