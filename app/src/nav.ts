export type Route =
  | { name: "search" }
  | { name: "themes" }
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
  | { name: "apropos" };

export interface Nav {
  push: (route: Route) => void;
  pop: () => void;
}
