import type { ConfrontationScrutin, DeputeResume, AngleShuffle } from "./types";
import type { Reponse } from "./testProximite/score";

export type Route =
  | { name: "search" }
  | { name: "themes" }
  | { name: "grandsScrutins" }
  | { name: "partis" }
  | { name: "parti"; uid: string }
  | { name: "membresParti"; uid: string; libelle: string }
  | {
      name: "votesParti";
      uid: string;
      libelle: string;
      categorie: string;
      categorieLibelle: string;
      position: string;
      periode: "all" | "12m" | "6m";
    }
  | { name: "depute"; uid: string }
  | { name: "scrutin"; uid: string }
  | { name: "categorie"; id: string; libelle: string }
  | { name: "dissidences"; uid: string; nom: string }
  | {
      name: "votesCategorie";
      uid: string;
      nom: string;
      categorie: string;
      categorieLibelle: string;
      periode: "all" | "12m" | "6m";
    }
  | {
      name: "votesDepute";
      uid: string;
      nom: string;
      categorie: string;
      categorieLibelle: string;
      position: string;
    }
  | {
      name: "votants";
      scrutinUid: string;
      titre: string;
      position: string;
      groupe?: string;
      groupeLibelle?: string;
    }
  | { name: "apropos" }
  | { name: "confrontation"; a?: string; b?: string; periode?: "all" | "12m" | "6m"; hasard?: boolean; angle?: AngleShuffle }
  | {
      name: "confrontationListe";
      kind: "accord" | "desaccord";
      themeLibelle: string;
      sousTitre: string;
      scrutins: ConfrontationScrutin[];
      depA: DeputeResume; // pour la barre sticky des deux élus (contexte)
      depB: DeputeResume;
      communs: number; // total de scrutins communs du thème (pour le taux affiché)
    }
  | { name: "monDepute" }
  // source : pré-filtre l'écran Suivis sur une catégorie de suivis (élus / partis).
  | { name: "suivis"; source?: "deputes" | "partis" }
  | { name: "mentions" }
  | { name: "parametres" }
  // Test de proximité : intro (animation + choix du mode), déroulé, résultat.
  | { name: "testIntro"; theme?: string; themeLibelle?: string }
  | { name: "test"; mode: "theme" | "complet" | "affiner"; theme?: string; themeLibelle?: string }
  // reponses/poids absents = résultat de L'UTILISATEUR (lu depuis le stockage local).
  // partage=true (+ reponses/poids) = résultat d'un LIEN partagé : lecture seule, rien n'est persisté.
  | { name: "testResultat"; reponses?: Record<number, Reponse>; themesJoues?: string[]; poids?: Record<string, number>; partage?: boolean }
  | { name: "testParTheme" };

export interface Nav {
  push: (route: Route) => void;
  pop: () => void;
  /** Remplace la route au sommet de la pile (sans empiler) — sert à persister un
   *  contexte d'écran (ex. la sélection d'un duel) pour le retrouver au retour. */
  replace: (route: Route) => void;
  /** Réinitialise la pile sur une route racine (= bascule d'onglet). Sert aux sorties
   *  de fin de parcours (ex. « Voir mon accueil » depuis le résultat du test). */
  reset: (route: Route) => void;
}
