// Sigle d'un groupe (EPR, LIOT, UDR…) qui se déplie en son nom complet. Maquette validée le
// 11/11/2026 (`maquette-sigles-et-recherche-unique`) : au repos rien ne change ; au toucher, une
// bulle encre sous le sigle donne le nom complet et un lien vers la fiche du groupe. Sans React
// (testé depuis pipeline/) : l'index des noms, la bulle unique et son placement.

export interface GroupeConnu {
  uid: string;
  abrev: string;
  libelle: string;
}

/** Index sigle → groupe, depuis partis.json (champ `libelle`, jamais un libellé en dur). Un groupe
 *  sans sigle ou sans nom n'y entre pas : son sigle s'affichera seul, sans bulle. */
export function indexerGroupes(
  partis: readonly { uid: string; abrev: string | null; libelle: string | null }[],
): Map<string, GroupeConnu> {
  const m = new Map<string, GroupeConnu>();
  for (const p of partis) {
    const abrev = p.abrev?.trim();
    const libelle = p.libelle?.trim();
    if (abrev && libelle && !m.has(abrev)) m.set(abrev, { uid: p.uid, abrev, libelle });
  }
  return m;
}

/** « EPR · Ensemble pour la République » */
export function texteBulle(g: GroupeConnu): string {
  return `${g.abrev} · ${g.libelle}`;
}

// --- La bulle : une seule ouverte à la fois -------------------------------------------------

export const DUREE_BULLE_MS = 4000;

/** Position du sigle à l'écran (measureInWindow). */
export interface Ancre {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bulle {
  /** Identifiant du sigle qui l'a ouverte (un par instance). */
  cle: string;
  groupe: GroupeConnu;
  ancre: Ancre;
  /** Ouverte par le survol de la souris (web) : se referme quand la souris s'en va. */
  survol?: boolean;
  /** Nœud du sigle, pour ne pas refermer la bulle quand on touche le sigle lui-même. */
  noeud?: unknown;
}

let bulle: Bulle | null = null;
let minuteur: ReturnType<typeof setTimeout> | null = null;
const abonnes = new Set<() => void>();

function emettre(): void {
  abonnes.forEach((f) => f());
}

function annulerMinuteur(): void {
  if (minuteur) {
    clearTimeout(minuteur);
    minuteur = null;
  }
}

export function bulleCourante(): Bulle | null {
  return bulle;
}

export function abonnerBulle(f: () => void): () => void {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

/** Ouvre la bulle (et ferme celle qui était ouverte). Elle se referme seule après 4 s. */
export function ouvrirBulle(b: Bulle): void {
  annulerMinuteur();
  bulle = b;
  minuteur = setTimeout(fermerBulle, DUREE_BULLE_MS);
  emettre();
}

export function fermerBulle(): void {
  annulerMinuteur();
  if (!bulle) return;
  bulle = null;
  emettre();
}

/** Toucher un sigle : ouvre sa bulle, ou la referme si elle est déjà ouverte. Une bulle ouverte
 *  au survol puis cliquée reste ouverte (le clic la « confirme »). */
export function basculerBulle(b: Bulle): void {
  if (bulle?.cle === b.cle && !bulle.survol) fermerBulle();
  else ouvrirBulle({ ...b, survol: false });
}

/** Survol (web) : ouvre la bulle du sigle survolé, ou la garde si c'est déjà la sienne. */
export function survolerSigle(b: Bulle): void {
  if (bulle?.cle === b.cle) annulerMinuteur();
  else ouvrirBulle({ ...b, survol: true });
}

/** La souris entre dans la bulle : elle reste ouverte tant qu'elle y est. */
export function garderBulle(): void {
  annulerMinuteur();
}

/** La souris quitte le sigle ou la bulle : une bulle ouverte au survol se referme peu après (le
 *  temps de passer du sigle à la bulle). Une bulle ouverte au toucher garde ses 4 s. */
export function quitterSurvol(delaiMs = 300): void {
  if (!bulle) return;
  annulerMinuteur();
  minuteur = setTimeout(fermerBulle, bulle.survol ? delaiMs : DUREE_BULLE_MS);
}

// --- Placement -------------------------------------------------------------------------------

export const BULLE_LARGEUR_MAX = 260;
const MARGE = 8; // distance minimale aux bords de l'écran
const ECART = 6; // entre le sigle et la bulle
const HAUTEUR_PROBABLE = 84; // nom sur 2 lignes + lien : pour choisir dessous ou dessus
const RETRAIT = 12; // la bulle déborde un peu du sigle, la pointe tombe sous son milieu

export interface Placement {
  /** Ancrée à gauche (sigle dans la moitié gauche) ou à droite (moitié droite). */
  cote: "gauche" | "droite";
  /** Distance au bord gauche (côté gauche) ou droit (côté droit) de l'écran. */
  bord: number;
  /** Sous le sigle (sinon au-dessus, quand la place manque en bas). */
  dessous: boolean;
  /** top (dessous) ou bottom (dessus), depuis le haut ou le bas de l'écran. */
  vertical: number;
  largeurMax: number;
  /** Milieu de la pointe, depuis le bord d'ancrage de la bulle. */
  pointe: number;
}

export function placerBulle(a: Ancre, ecran: { w: number; h: number }): Placement {
  const milieu = a.x + a.w / 2;
  const dessous = a.y + a.h + ECART + HAUTEUR_PROBABLE <= ecran.h - MARGE;
  const vertical = dessous ? a.y + a.h + ECART : ecran.h - a.y + ECART;
  const cote = milieu <= ecran.w / 2 ? "gauche" : "droite";
  const bord = cote === "gauche"
    ? Math.max(MARGE, a.x - RETRAIT)
    : Math.max(MARGE, ecran.w - (a.x + a.w) - RETRAIT);
  const largeurMax = Math.max(120, Math.min(BULLE_LARGEUR_MAX, ecran.w - MARGE - bord));
  const brut = cote === "gauche" ? milieu - bord : ecran.w - bord - milieu;
  const pointe = Math.min(Math.max(brut, 14), largeurMax - 14);
  return { cote, bord, dessous, vertical, largeurMax, pointe };
}
