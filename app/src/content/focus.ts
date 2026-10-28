import type { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { FocusDef } from "../hebdo";

/**
 * FOCUS ACTUALITÉ de l'accueil — fichier ÉDITÉ À LA MAIN (pas de flux tiers dans l'app).
 *
 * Deux formes, selon la chambre qui a voté (`chambre`) :
 * - "AN" : une frise des textes votés en scrutin public à l'Assemblée.
 *   · Le choix du SUJET est éditorial et assumé : il est écrit sous le focus (`critere`).
 *   · Le choix des TEXTES est mécanique : `motsCles` est appliqué aux intitulés (dossier + texte
 *     cité dans les scrutins) par `textesFocus` (hebdo.ts). `critere` doit décrire EXACTEMENT
 *     `motsCles`, sinon ce qui est affiché ment.
 *   · `aSuivre` est une phrase factuelle figée : la relire à chaque mise à jour des données.
 * - "Senat" : un vote du Sénat, que les données de l'app ne contiennent pas. Tout est saisi ici,
 *   sauf le scrutin de l'Assemblée lié (`scrutinANLie`), dont les décomptes sont lus dans les
 *   données. Décomptes par groupe du Sénat (`voix`) : null tant que le scrutin public de
 *   senat.fr n'est pas publié, jamais estimés.
 * Hors de la période `du`…`au` (dates ISO, incluses), le focus disparaît de l'accueil.
 * Pas de focus : `FOCUS = null`.
 * Mots-clés : bornes de mot écrites à la main ([^\wÀ-ÿ]) car \b ignore les lettres accentuées.
 */
interface FocusCommun {
  id: string;
  du: string;
  au: string;
  titre: string;
}

export interface FocusAN extends FocusDef, FocusCommun {
  chambre: "AN";
  contexte: string;
  critere: string;
  aSuivre?: string;
  /** Thème dont la teinte marque le focus (categoryUI), facultatif. */
  categorie?: string;
}

/** Position annoncée d'un groupe ; "nc" = non communiquée. */
export type PositionGroupe = "pour" | "contre" | "abstention" | "nc";

export interface GroupeSenat {
  sigle: string;
  nom: string;
  equivalentAN: string;
  /** Sigle (`abrev`) du groupe AN équivalent dans les données, pour sa couleur. Absent : pastille neutre. */
  groupeANRef?: string;
  position: PositionGroupe;
  /** Décompte officiel du scrutin public de senat.fr ; null tant qu'il n'est pas publié. */
  voix?: { pour: number; contre: number; abstention: number } | null;
}

/** Picto d'une ligne « Ce que dit le texte » (@expo/vector-icons). */
export type IconeFocus =
  | { famille: "feather"; nom: keyof typeof Feather.glyphMap }
  | { famille: "mci"; nom: keyof typeof MaterialCommunityIcons.glyphMap };

export interface FocusSenat extends FocusCommun {
  chambre: "Senat";
  sousTitre: string;
  points: { icone: IconeFocus; texte: string }[];
  /** Vote du Sénat. `dateLabel` : libellé à droite du titre du bloc résultat. */
  resultat: { pour: number; contre: number; abstention?: number; dateLabel: string };
  groupesSenat?: GroupeSenat[];
  noteGroupes?: string;
  /** Scrutin de l'Assemblée sur une mesure proche : décomptes et groupes lus dans les données (`scrutinId`). */
  scrutinANLie?: { scrutinId: string; titre: string; description: string; dateLabel: string; avertissement?: string; lecture?: string };
  parcours?: { etape: string; detail: string; etat: "fait" | "encours" | "afaire" }[];
  procedure?: string;
}

export type FocusActu = FocusAN | FocusSenat;

export const FOCUS: FocusActu | null = {
  chambre: "Senat",
  id: "casseurs-payeurs-2026",
  du: "2026-10-28",
  au: "2026-11-30",
  titre: "Casseurs-payeurs",
  sousTitre: "Projet de loi du gouvernement, voté par les sénateurs dans la nuit du 27 au 28 octobre 2026",
  points: [
    {
      icone: { famille: "feather", nom: "users" },
      texte: "Participer sciemment à un groupe qui casse rend solidaire des dégâts, jusqu'à 10 000 € par personne.",
    },
    {
      icone: { famille: "mci", nom: "cash" },
      texte: "Allocations familiales, APL et RSA deviennent saisissables pour payer.",
    },
    {
      icone: { famille: "feather", nom: "shield" },
      texte: "Interdictions de manifester, drones, vidéo algorithmique, expulsion du logement social.",
    },
  ],
  resultat: { pour: 229, contre: 105, dateLabel: "334 votes exprimés" },
  groupesSenat: [
    { sigle: "LR", nom: "Les Républicains", equivalentAN: "Droite républicaine", groupeANRef: "DR", position: "pour", voix: null },
    { sigle: "RN", nom: "Rassemblement national", equivalentAN: "RN", groupeANRef: "RN", position: "pour", voix: null },
    { sigle: "UC", nom: "Union centriste", equivalentAN: "MoDem et UDI, sans groupe unique", position: "pour", voix: null },
    {
      sigle: "RDPI",
      nom: "Rassemblement des démocrates, progressistes et indépendants",
      equivalentAN: "Ensemble pour la République",
      groupeANRef: "EPR",
      position: "pour",
      voix: null,
    },
    { sigle: "SER", nom: "Socialistes, écologistes et républicains", equivalentAN: "Socialistes", groupeANRef: "SOC", position: "contre", voix: null },
    {
      sigle: "CRCE-K",
      nom: "Communiste, républicain, citoyen et écologiste",
      equivalentAN: "Gauche démocrate et républicaine",
      groupeANRef: "GDR",
      position: "contre",
      voix: null,
    },
    { sigle: "GEST", nom: "Écologiste, solidarité et territoires", equivalentAN: "Écologiste et social", groupeANRef: "ECOS", position: "contre", voix: null },
    { sigle: "LIRT", nom: "Les Indépendants", equivalentAN: "Horizons", groupeANRef: "HOR", position: "nc", voix: null },
    { sigle: "RDSE", nom: "Rassemblement démocratique et social européen", equivalentAN: "Pas d'équivalent, radicaux", position: "nc", voix: null },
  ],
  noteGroupes: "LFI n'a pas de sénateurs. Il n'existe pas d'équivalent de LIOT au Sénat.",
  // Scrutin n° 8045 du 8 juillet 2026 : 33 pour, 69 contre, 29 abstentions, rejeté (vérifié dans
  // les données). Lecture vérifiée : RN 0 pour, 8 contre, 21 abst. ; EPR 10 pour, 18 contre, 3 abst.
  scrutinANLie: {
    scrutinId: "VTANR5L17V8045",
    titre: "En juillet, les députés avaient refusé la responsabilité solidaire",
    description: "Amendement n° 435 (Le Fur, DR) au projet de loi Ripost : rendre les participants d'une rave-party illégale solidaires des dégâts.",
    dateLabel: "8 juil. 2026",
    lecture: "Le RN s'était abstenu et EPR s'était divisé. Au Sénat, leurs homologues ont voté pour.",
    avertissement: "Le champ n'était pas le même : rave-parties, pas manifestations.",
  },
  procedure: "Procédure accélérée : une lecture par chambre",
  parcours: [
    { etape: "Sénat", detail: "Adopté le 28 oct.", etat: "fait" },
    { etape: "Assemblée", detail: "Pas encore inscrit", etat: "encours" },
    { etape: "Commission mixte paritaire", detail: "Puis vote final", etat: "afaire" },
  ],
};
