export type Route =
  | { name: "search" }
  | { name: "depute"; uid: string }
  | { name: "scrutin"; uid: string }
  | { name: "categorie"; id: string; libelle: string }
  | { name: "dissidences"; uid: string; nom: string }
  | { name: "apropos" };

export interface Nav {
  push: (route: Route) => void;
  pop: () => void;
}
