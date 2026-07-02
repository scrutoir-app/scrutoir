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
  // Présent dans le `depute` des profils (depute/<uid>.json). Non-null = a quitté
  // l'Assemblée en cours de législature (remplacé, nommé au gouvernement…) : sa
  // fiche existe (via les votants des scrutins) mais il est hors index de recherche.
  mandat_fin?: string | null;
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

// Agrégat des amendements DÉPOSÉS sur un texte, par auteur (pré-calculé au pipeline,
// rattaché au scrutin via son dossier législatif). Aucun amendement unitaire n'est exporté.
export interface AmendSorts {
  total: number;
  adoptes: number;
  rejetes: number;
  tombes: number;
  retires: number;
  irrecevables: number;
  articleTop: string | null; // désignation courte de l'article le plus visé (ex. "ART. 4")
  articleTopN: number; // nb d'amendements sur cet article
  articlesDistincts: number; // nb d'articles distincts visés
}
export interface AmendGroupe extends AmendSorts {
  groupe: string; // uid d'organe (PO…)
  abrev: string | null;
  libelle: string;
  couleur: string | null;
}
export interface AmendInstitutionnel extends AmendSorts {
  kind: "gouv" | "commission";
}
export interface AmendementsDossier {
  dossierRef: string; // uid du dossier (DLR…) → lien source AN
  total: number; // tous auteurs (groupes + gouv + commission + refs inconnues)
  adoptes: number; // tous auteurs
  nbGroupes: number; // groupes parlementaires ayant déposé
  moyenne: number; // total déposé par les groupes / nbGroupes (repère d'écart)
  groupes: AmendGroupe[];
  institutionnels: AmendInstitutionnel[];
}

export interface DetailScrutin {
  scrutin: ScrutinResume & {
    type_vote: string | null;
    pour: number;
    contre: number;
    abstention: number;
    nonvotant: number;
    dossier_titre: string | null; // intitulé officiel du dossier législatif (Open Data AN)
    dossier_ref?: string | null; // uid du dossier (DLR…)
  };
  groupes: GroupeVentilation[];
  amendement: Amendement | null;
  amendements?: AmendementsDossier | null; // agrégat des amendements déposés sur le texte
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

// Un vote d'un élu suivi (feed de l'onglet Suivis).
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

// « Shuffle » de la confrontation : une paire surprenante piochée dans un vivier
// pré-calculé. Trois angles, chacun porteur d'une surprise (cf. pipeline).
export type AngleShuffle = "fracture_interne" | "alliance_contre_nature" | "faux_duel";
export interface ShuffleConfrontation {
  angle: AngleShuffle;
  a: DeputeResume;
  b: DeputeResume;
  communs: number;
  tauxAccord: number; // accords / communs, en pourcentage entier
}
