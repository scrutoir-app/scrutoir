/**
 * Contenu PÉDAGOGIQUE « parcours d'une loi » — SOURCE UNIQUE (aucun fetch, vit dans l'app,
 * fonctionne hors-ligne). Civique et stable. Sert le composant `ParcoursLoi`.
 *
 * ⚠️ Honnêteté (ADN Scrutoir) : l'étape 4 dit clairement que la PLUPART des votes sont
 * invisibles (main levée). Le schéma SITUE Scrutoir dans le processus, il ne laisse pas
 * croire qu'on montre tout. « amendement » = l'objet législatif, jamais « tout ce que
 * Scrutoir affiche ». Neutralité : aucune couleur de parti.
 *
 * PARCOURS_VERSION : à incrémenter si le contenu change → l'interstitiel est re-proposé.
 */
export const PARCOURS_VERSION = "1";

export interface EtapeParcours {
  titre: string;
  def: string;
  /** Étape du vote = le seul moment que Scrutoir observe (accent + badge + hémicycle). */
  scrutin?: boolean;
}

export const PARCOURS_TITRE = "Le parcours d'une loi";
export const PARCOURS_INTRO =
  "Loi, texte, amendement, scrutin : qui est qui ? Voici où Scrutoir intervient.";
export const PARCOURS_BADGE = "Scrutoir ne voit que ça";

export const ETAPES: EtapeParcours[] = [
  {
    titre: "Un texte est déposé",
    def: "Projet de loi (déposé par le gouvernement) ou proposition de loi (déposée par des parlementaires).",
  },
  {
    titre: "Examen en commission",
    def: "Les députés amendent le texte, article par article.",
  },
  {
    titre: "Débat en séance",
    def: "Nouveaux amendements, discussions, puis on passe au vote.",
  },
  {
    titre: "On vote",
    def: "La plupart des votes ont lieu à main levée, sans trace. Seuls quelques-uns sont des scrutins publics nominatifs.",
    scrutin: true,
  },
  {
    titre: "Vote solennel sur l'ensemble",
    def: "Le vote final sur le texte entier — souvent un scrutin public.",
  },
  {
    titre: "Sénat puis promulgation",
    def: "Navette entre les deux chambres, puis entrée en vigueur de la loi.",
  },
];

export interface MotGlossaire {
  mot: string;
  def: string;
}

export const GLOSSAIRE_TITRE = "Les 4 mots à ne pas confondre";

export const GLOSSAIRE: MotGlossaire[] = [
  {
    mot: "Projet ou proposition de loi",
    def: "Même type de texte ; on les distingue par qui le dépose : le gouvernement (projet) ou des parlementaires (proposition).",
  },
  {
    mot: "Texte",
    def: "Le document complet en discussion, composé d'articles. Le contenant.",
  },
  {
    mot: "Amendement",
    def: "Une modification d'un article, proposée puis soumise au vote.",
  },
  {
    mot: "Scrutin public",
    def: "Un vote nominatif — sur un amendement, un article ou l'ensemble. Le seul objet que Scrutoir affiche.",
  },
];
