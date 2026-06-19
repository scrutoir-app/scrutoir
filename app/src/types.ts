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
  // Présents sur certains endpoints (grands scrutins, scrutins par thème)
  pour?: number;
  contre?: number;
  abstention?: number;
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
  reussite_pct: number | null;
  gagnes: number;
  perdus: number;
}

export interface ProfilDepute {
  depute: DeputeResume;
  loyaute_globale_pct: number | null;
  participation_pct: number | null;
  participation_rang_pct: number | null;
  reussite_globale_pct: number | null;
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

export interface Amendement {
  numero: number | null;
  auteur: string | null;
  article: string | null;
  dispositif: string | null;
  expose: string | null;
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
  amendement: Amendement | null;
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

export interface VoteScrutin extends ScrutinResume {
  position: string;
}

export interface Votant {
  uid: string;
  nom_complet: string;
  photo_url: string | null;
  abrev: string | null;
  groupe: string | null;
  couleur: string | null;
}

export type Periode = "all" | "12m" | "6m";
