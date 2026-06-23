import type { ConfrontationScrutin } from "./types";

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
  | { name: "confrontation"; a?: string; b?: string; periode?: "all" | "12m" | "6m" }
  | {
      name: "confrontationListe";
      kind: "accord" | "desaccord";
      themeLibelle: string;
      sousTitre: string;
      scrutins: ConfrontationScrutin[];
    }
  | { name: "monDepute" }
  | { name: "suivis" }
  | { name: "mentions" }
  | { name: "parametres" };

export interface Nav {
  push: (route: Route) => void;
  pop: () => void;
  /** Remplace la route au sommet de la pile (sans empiler) — sert à persister un
   *  contexte d'écran (ex. la sélection d'un duel) pour le retrouver au retour. */
  replace: (route: Route) => void;
}
