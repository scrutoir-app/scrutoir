export interface DeputeResume {
  uid: string;
  nom_complet: string;
  groupe: string | null;
  groupe_uid?: string | null;
  abrev: string | null;
  couleur: string | null;
  photo_url: string | null;
  departement?: string | null;
  num_departement?: string | null;
  circo?: string | null;
}

export interface Departement {
  num: string;
  nom: string;
  circos: number;
}

export interface ScrutinResume {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_code: string | null;
  sort_libelle: string | null;
  dossier_titre?: string | null; // intitulé officiel du dossier législatif (plus clair que l'objet brut)
  categorie?: string | null; // catégorie principale (picto)
  type_vote?: string | null;
  // Présents sur certains endpoints (grands scrutins, scrutins par thème)
  pour?: number;
  contre?: number;
  abstention?: number;
  // Porteur du texte (auteur/rapporteur) — branché plus tard via Dossiers législatifs
  porteur_nom?: string | null;
  porteur_photo?: string | null;
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
  nonvotant: number;
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
    dossier_titre: string | null; // intitulé officiel du dossier législatif (Open Data AN)
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
  nb_scrutins?: number;
  derniere_date?: string | null;
  dernier_titre?: string | null;
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
  consigne?: string | null; // consigne du groupe sur ce scrutin (pour lire l'écart)
}

// Un vote d'un·e élu·e suivi·e (feed de l'onglet Suivis).
export interface VoteSuivi {
  deputeUid: string;
  nom: string;
  photo: string | null;
  abrev: string | null;
  couleur: string | null;
  scrutinUid: string;
  titre: string | null;
  date: string | null;
  numero: number | null;
  position: string;
  sort_code: string | null;
  categorie?: string | null;
}

export interface Votant {
  uid: string;
  nom_complet: string;
  photo_url: string | null;
  abrev: string | null;
  groupe: string | null;
  couleur: string | null;
}

export interface PartiResume {
  uid: string;
  libelle: string;
  abrev: string | null;
  couleur: string | null;
  nb_deputes: number;
  reussite_pct: number | null;
}

export interface PartiCategorie {
  id: string;
  libelle: string;
  emoji: string;
  couleur: string;
  pour: number;
  contre: number;
  abstention: number;
  gagnes: number;
  perdus: number;
  reussite_pct: number | null;
}

export interface ProfilParti {
  parti: { uid: string; libelle: string; abrev: string | null; couleur: string | null; nb_deputes: number };
  president: { uid: string; nom_complet: string; photo_url: string | null } | null;
  cohesion_pct: number | null;
  participation_moy_pct: number | null;
  reussite_globale_pct: number | null;
  amendements: number;
  propositions: number;
  amendements_par_elu: number | null;
  amendements_ratio: number | null;
  propositions_par_elu: number | null;
  propositions_ratio: number | null;
  cohesion_moy?: number | null;
  participation_moy?: number | null;
  categories: PartiCategorie[];
}

export interface PartiReussiteCategorie {
  uid: string;
  abrev: string | null;
  libelle: string;
  couleur: string | null;
  reussite_pct: number | null;
  gagnes: number;
  perdus: number;
}

export type Periode = "all" | "12m" | "6m";

export interface ConfrontationScrutin {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  objet: string | null;
  sort_code: string | null;
  resume: string | null;
  posA: string;
  posB: string;
}
export interface ConfrontationTheme {
  id: string;
  libelle: string;
  ordre: number;
  communs: number;
  desaccords: ConfrontationScrutin[];
  accords: ConfrontationScrutin[];
}
export interface Confrontation {
  a: DeputeResume;
  b: DeputeResume;
  periode: Periode;
  communs: number;
  desaccords: number;
  accords: number;
  themes: ConfrontationTheme[];
}
