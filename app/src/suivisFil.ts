// Écran Suivis : UNE ligne par vote, la position de chacun de tes suivis dessous — LOGIQUE PURE
// (aucun import React / RN), testée hors app (`suivisFil.test.ts`, garde de refresh.yml).
// Maquette validée le 15/10/2026 : `maquette-suivis-un-vote-tous-tes-suivis.html`.
//
// Le titre d'une ligne dit ce qui a été voté (`ceQuiEstVote`, lot 2) et le texte de loi passe en
// contexte dessous ; pour un vote sur l'ensemble, le titre est le texte lui-même. Lecture
// MÉCANIQUE de l'intitulé officiel : rien n'est reformulé. Tout reste sur l'appareil : les votes
// viennent des fichiers publics déjà chargés, la liste des suivis ne quitte pas l'appareil.

import { ceQuiEstVote, type NatureVote } from "./typeScrutin";
import { titreLigne, dateCourte } from "./textes";
import { titreCourt, issueDe } from "./hebdo";
import { bornePeriode, type PeriodeGlissante } from "./periode";

/** Vote d'un suivi tel que le donnent `getVotesSuivis` / `getVotesPartisSuivis` (api.ts). */
export interface VoteSuiviSrc {
  /** uid du député (PA…) ou du groupe (PO…) suivi. */
  deputeUid: string;
  scrutinUid: string;
  titre: string | null;
  type_vote?: string | null;
  dossier_ref?: string | null;
  date: string | null;
  numero: number | null;
  position: string;
  sort_code: string | null;
  categorie?: string | null;
}

/** Position d'un suivi sur un vote (une pastille sous la ligne). */
export interface PositionSuivi {
  uid: string;
  position: string;
}

/** Une ligne = un scrutin où au moins un de tes suivis a voté (données brutes, sans libellés). */
export interface LigneVote {
  scrutinUid: string;
  date: string | null;
  numero: number | null;
  categorie: string | null;
  sort_code: string | null;
  /** Intitulé officiel du scrutin, type de vote et dossier : de quoi décrire la ligne (`decrireLigne`). */
  intitule: string | null;
  type_vote: string | null;
  dossier_ref: string | null;
  /** Une position par suivi qui a pris part au vote, dans l'ordre des puces. */
  positions: PositionSuivi[];
}

/** Ce qu'affiche une ligne : libellés calculés pour les seules lignes visibles. */
export interface DescriptionLigne {
  nature: NatureVote;
  /** « Amendement · 14 oct. · adopté » */
  meta: string;
  /** Ce qui a été voté (pour un vote sur l'ensemble : le texte lui-même). */
  titre: string;
  /** Le texte de loi en contexte, ou null (vote sur l'ensemble, ou scrutin sans texte visé). */
  contexte: string | null;
}

// Natures au féminin (« Motion · rejetée », « Partie du texte · adoptée »).
const FEMININ = new Set<NatureVote>(["partie", "motion", "censure", "declaration", "procedure"]);

/** « adopté », « rejetée »… accordé à la nature du vote ; null si l'issue n'est pas connue. */
export function issueAccordee(sort: string | null | undefined, nature: NatureVote): string | null {
  const i = issueDe(sort);
  if (!i) return null;
  return `${i === "adopte" ? "adopté" : "rejeté"}${FEMININ.has(nature) ? "e" : ""}`;
}

/**
 * Titre et contexte d'une ligne. Le nom du texte vient du dossier législatif (`titreDossier`,
 * intitulé officiel) ou, à défaut, de l'intitulé du scrutin ; « Proposition de loi visant à »
 * part comme sur l'onglet Scrutins (`titreCourt`).
 */
export function titreEtContexte(
  s: { titre?: string | null; type_vote?: string | null },
  titreDossier: string | null | undefined,
): { nature: NatureVote; etiquette: string; titre: string; contexte: string | null } {
  const c = ceQuiEstVote(s);
  const brut = titreDossier?.trim() || c.texte;
  const texte = brut ? titreCourt(brut) : null;
  if (c.nature === "ensemble") return { nature: c.nature, etiquette: c.etiquette, titre: texte ?? c.titre, contexte: null };
  return { nature: c.nature, etiquette: c.etiquette, titre: titreLigne({ titre: s.titre ?? null, type_vote: s.type_vote }), contexte: texte };
}

/**
 * Regroupe les votes de tes suivis par scrutin : une ligne par vote, du plus récent au plus
 * ancien, avec la position de chaque suivi dans l'ordre `ordre` (celui des puces ; le vote d'un
 * uid absent de `ordre` est ignoré). Aucun libellé ici : des dizaines de milliers de votes
 * passent par là, seules les lignes affichées sont décrites (`decrireLigne`).
 */
export function regrouperParVote(votes: VoteSuiviSrc[], ordre: string[]): LigneVote[] {
  const rang = new Map(ordre.map((u, i) => [u, i]));
  const parScrutin = new Map<string, LigneVote>();
  for (const v of votes) {
    if (!rang.has(v.deputeUid)) continue; // suivi introuvable dans l'index (ex-député) : pas de pastille orpheline
    let l = parScrutin.get(v.scrutinUid);
    if (!l) {
      l = {
        scrutinUid: v.scrutinUid,
        date: v.date,
        numero: v.numero,
        categorie: v.categorie ?? null,
        sort_code: v.sort_code,
        intitule: v.titre,
        type_vote: v.type_vote ?? null,
        dossier_ref: v.dossier_ref ?? null,
        positions: [],
      };
      parScrutin.set(v.scrutinUid, l);
    }
    if (!l.positions.some((p) => p.uid === v.deputeUid)) l.positions.push({ uid: v.deputeUid, position: v.position });
  }
  const lignes = [...parScrutin.values()];
  for (const l of lignes) l.positions.sort((a, b) => rang.get(a.uid)! - rang.get(b.uid)!);
  return lignes.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.numero ?? 0) - (a.numero ?? 0));
}

/**
 * Libellés d'une ligne : titre, contexte et méta (« Amendement · 14 oct. · adopté »). `dossiers`
 * relie un dossier_ref à son intitulé officiel ; `annee` = année courante (dates courtes sans année).
 */
export function decrireLigne(l: LigneVote, dossiers: Map<string, string>, annee: string | null): DescriptionLigne {
  const t = titreEtContexte({ titre: l.intitule, type_vote: l.type_vote }, l.dossier_ref ? dossiers.get(l.dossier_ref) : null);
  const meta = [t.etiquette, dateCourte(l.date, annee), issueAccordee(l.sort_code, t.nature)].filter(Boolean).join(" · ");
  return { nature: t.nature, meta, titre: t.titre, contexte: t.contexte };
}

// --- Filtres (derrière le bouton « Filtres ») ---------------------------------------------

/** « Depuis 2024 », « 12 mois », « 6 mois » : borne commune à toute l'app (`periode.ts`). */
export type PeriodeSuivis = PeriodeGlissante;
export type IssueSuivis = "all" | "adopte" | "rejete";

/** Nombre de filtres actifs (affiché sur le bouton « Filtres »). */
export function nbFiltresActifs(periode: PeriodeSuivis, issue: IssueSuivis): number {
  return (periode !== "all" ? 1 : 0) + (issue !== "all" ? 1 : 0);
}

/**
 * Applique période, issue et sélection de suivis (vide = tous). Avec une sélection, une ligne
 * reste si l'un des suivis choisis a voté, et seules leurs pastilles restent dessous.
 */
export function filtrerLignes(
  lignes: LigneVote[],
  f: { periode: PeriodeSuivis; issue: IssueSuivis; selection: ReadonlySet<string>; aujourdhui: string },
): LigneVote[] {
  const borne = bornePeriode(f.periode, f.aujourdhui);
  const out: LigneVote[] = [];
  for (const l of lignes) {
    if (borne && (l.date || "") < borne) continue;
    if (f.issue !== "all" && issueDe(l.sort_code) !== f.issue) continue;
    if (!f.selection.size) { out.push(l); continue; }
    const positions = l.positions.filter((p) => f.selection.has(p.uid));
    if (positions.length) out.push({ ...l, positions });
  }
  return out;
}

/**
 * Initiales d'un nom : le prénom, puis le premier mot suivant qui commence par une capitale
 * (« Audrey Abadie-Amiel » → « AA », « Charles de Courson » → « CC », « Marine Le Pen » → « ML »).
 */
export function initiales(nom: string): string {
  const mots = nom.split(/\s+/).filter(Boolean);
  if (!mots.length) return "?";
  const second = mots.slice(1).find((m) => /^\p{Lu}/u.test(m)) ?? mots[1];
  return [mots[0], second].filter(Boolean).map((m) => m![0]).join("").toUpperCase();
}

/** Libellé lu d'une ligne (lecteur d'écran) : méta, titre, contexte, puis chaque suivi et sa position. */
export function phraseLigne(
  l: Pick<LigneVote, "positions">,
  d: DescriptionLigne,
  nomDe: (uid: string) => string,
  libellePosition: (p: string) => string,
): string {
  const qui = l.positions.map((p) => `${nomDe(p.uid)} : ${libellePosition(p.position).toLowerCase()}`).join(", ");
  return [d.meta, d.titre, d.contexte, qui].filter(Boolean).join(". ");
}
