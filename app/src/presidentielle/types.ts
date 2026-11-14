// Rubrique Présidentielle 2027 : forme des fichiers statiques data/presidentielle/**.
// Écrits par pipeline/src/exportPresidentielle.ts, lus par l'app (presidentielle/donnees.ts).
// Aucun pourcentage nulle part : uniquement des nombres.

/** Statut public d'une mesure. c cohérent · t tension · s sans scrutin public · j à juger ·
 *  r sans vote représentatif · h hors champ (aucun vote ne peut la porter). */
export type Statut = "c" | "t" | "s" | "j" | "r" | "h";
/** Les trois familles publiques : cohérent, tension, neutre (= s + j + r). */
export type Famille = "c" | "t" | "n";
/** Périmètre choisi sur l'écran programme : tout le programme, mesures clés, chiffrées. */
export type Perimetre = "all" | "cle" | "ch";
export type Filtre = "toutes" | Famille;
export type SousNeutre = "tout" | "s" | "j" | "r";

export interface Comptes {
  c: number;
  t: number;
  s: number;
  j: number;
  r: number;
}

export interface GroupeRef {
  uid: string;
  abrev: string;
  libelle: string;
}

/** Base de scrutins contre laquelle le programme a été confronté (limites de la méthode). */
export interface BaseScrutins {
  scrutins: number;
  du: string; // AAAA-MM-JJ
  au: string;
}

/** Une entrée de data/presidentielle/index.json (programme EN SERVICE uniquement). */
export interface ProgrammeResume {
  id: string;
  alias: string[];
  parti: string;
  /** Groupe confronté à l'Assemblée ; null = parti sans groupe (affiché sans confrontation). */
  groupe: GroupeRef | null;
  publieLe: string; // AAAA-MM-JJ
  mesures: number;
  chiffrees: number;
  base: BaseScrutins;
}

export interface IndexPresidentielle {
  generatedAt: string;
  programmes: ProgrammeResume[];
}

export interface ChapitreResume {
  id: string; // « p2c2 »
  partie: number;
  partieTitre: string;
  numero: number;
  titre: string;
  url: string | null;
  mesures: number;
  horsChamp: number;
}

/** Mesure en version légère (programme.json) : de quoi lister, filtrer et compter. */
export interface MesureLegere {
  id: string;
  chapitre: string;
  section: string | null;
  texte: string;
  cle: boolean;
  sousMesureDe: string | null;
  statut: Statut;
  nScrutins: number;
  motifHorsChamp?: string;
  /** Code de la ligne du chiffrage dont c'est la mesure principale (« D13 »). */
  chiffree?: string;
}

export interface LigneChiffree {
  code: string; // R01…R14, D01…D14
  type: "recette" | "depense";
  libelle: string;
  statut: Exclude<Statut, "h">;
  /** Mesure principale du programme confrontée pour cette ligne, ou null (confrontée sur son libellé). */
  mesure: string | null;
  /** Autres mesures du programme rattachées à la ligne (avec leur statut). */
  secondaires: { id: string; statut: Statut }[];
}

export interface Programme extends ProgrammeResume {
  livre: { titre: string; url: string };
  chiffrage: { titre: string; url: string; date: string } | null;
  comptes: {
    mesures: number;
    confrontables: number;
    horsChamp: number;
    cles: number;
    clesConfrontables: number;
    chiffrees: number;
  };
  verdicts: Record<Perimetre, Comptes>;
  chapitres: ChapitreResume[];
  listeMesures: MesureLegere[];
  listeChiffrees: LigneChiffree[];
}

/** Effet d'un scrutin sur le verdict de la mesure.
 *  c cohérent · t tension · j à juger · r position non représentative (3 votants ou moins) ·
 *  o abstention sur un texte de sens inverse d'un autre groupe (sans effet) ·
 *  x aucun votant du groupe sur un texte de sens inverse (sans effet). */
export type Effet = "c" | "t" | "j" | "r" | "o" | "x";

export type PositionGroupe = "pour" | "contre" | "abstention" | "partage" | "aucun";

/** Alerte affichée sur un scrutin (formulée côté app). */
export type Alerte = "intitule-seul" | "auteur-du-groupe";

export interface ScrutinConfronte {
  numero: number;
  uid: string;
  date: string;
  sort: "adopte" | "rejete";
  sens: "meme" | "inverse";
  effet: Effet;
  position: PositionGroupe;
  pour: number;
  contre: number;
  abstention: number;
  votants: number;
  /** Intitulé officiel du scrutin, mot pour mot (sans le « Sur » de tête). */
  intitule: string;
  dossier?: string | null;
  base?: "dispositif" | "intitule" | "dossier";
  /** Extrait verbatim du texte voté qui porte la mesure. */
  extrait?: string;
  /** Écart relevé entre le scrutin et la mesure. */
  ecart?: string;
  note?: string;
  /** Pourquoi le même sens se discute (statut « à juger »). */
  raisonAJuger?: string;
  alertes: Alerte[];
}

export interface MesureDetail {
  id: string;
  scrutins: ScrutinConfronte[];
}

/** data/presidentielle/<id>/chapitre/<chapitreId>.json */
export interface ChapitreDetail {
  id: string;
  mesures: MesureDetail[];
}

/** data/presidentielle/<id>/chiffrage.json : scrutins des lignes confrontées sur leur libellé. */
export interface ChiffrageDetail {
  lignes: {
    code: string;
    raisonAJuger?: string;
    scrutins: ScrutinConfronte[];
  }[];
}
