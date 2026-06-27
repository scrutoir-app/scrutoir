import type { ConfrontationScrutin, DeputeResume } from "./types";
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
  | { name: "confrontation"; a?: string; b?: string; periode?: "all" | "12m" | "6m"; hasard?: boolean }
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
  | { name: "suivis" }
  | { name: "mentions" }
  | { name: "parametres" }
  // Test de proximité : intro (animation + choix du mode), déroulé, résultat.
  | { name: "testIntro"; theme?: string; themeLibelle?: string }
  | { name: "test"; mode: "theme" | "complet"; theme?: string; themeLibelle?: string }
  | { name: "testResultat"; reponses: Record<number, Reponse>; themesJoues?: string[]; poids?: Record<string, number> };

export interface Nav {
  push: (route: Route) => void;
  pop: () => void;
  /** Remplace la route au sommet de la pile (sans empiler) — sert à persister un
   *  contexte d'écran (ex. la sélection d'un duel) pour le retrouver au retour. */
  replace: (route: Route) => void;
}
