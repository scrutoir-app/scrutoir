export interface DeputeResume {
  uid: string;
  nom_complet: string;
  groupe: string | null;
  abrev: string | null;
  couleur: string | null;
  photo_url: string | null;
}

export interface ScrutinResume {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_code: string | null;
  sort_libelle: string | null;
}

export interface CategorieStats {
  id: string;
  libelle: string;
  emoji: string;
  couleur: string;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  total: number;
  pct_pour_exprimes: number | null;
  loyaute_pct: number | null;
  base_loyaute: number;
}

export interface ProfilDepute {
  depute: DeputeResume;
  loyaute_globale_pct: number | null;
  categories: CategorieStats[];
}

export interface GroupeVentilation {
  uid: string;
  libelle: string;
  abrev: string | null;
  couleur: string | null;
  consigne: string | null;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
}

export interface DetailScrutin {
  scrutin: ScrutinResume & {
    type_vote: string | null;
    pour: number;
    contre: number;
    abstention: number;
    nonvotant: number;
  };
  groupes: GroupeVentilation[];
}

export interface CategorieRef {
  id: string;
  libelle: string;
  emoji: string;
  couleur: string;
  ordre: number;
}

export interface Dissidence {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_libelle: string | null;
  position: string;
  consigne: string;
}

export type Periode = "all" | "12m" | "6m";
