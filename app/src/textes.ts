// Onglet Scrutins (sous-onglets Recherche et Textes) et page d'un texte : libellés et regroupements,
// LOGIQUE PURE (aucun import RN), testée hors app (`textes.test.ts`, garde de refresh.yml).
// Maquettes validées le 15/10/2026 : `maquette-onglet-scrutins-recherche-textes.html` et
// `maquette-page-texte-style-du-jour.html` (structure du 14/10, `maquette-scrutins-par-texte.html`).
//
// Tout est MÉCANIQUE : on lit l'intitulé officiel et les décomptes publiés par l'AN, on ne
// reformule rien et on ne juge pas le fond. Un amendement « a compté » par un critère affiché
// (`raisonsCompte`, hebdo.ts) ; sa raison est écrite sur sa ligne (« écart de 2 voix »).

import {
  natureScrutin,
  raisonsCompte,
  articleVise,
  issueDe,
  lectureDe,
  ajouterJours,
  ordreRecent,
  type ScrutinSrc,
  type TexteFil,
  type IndexTextes,
  type Issue,
  type VoteReference,
} from "./hebdo";
import { ceQuiEstVote } from "./typeScrutin";
import { normaliser } from "./search/normalize";

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); // 1 312
const pl = (n: number, s: string, p: string) => `${fmt(n)} ${n > 1 ? p : s}`;
const capitaliser = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const minuscule = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

// --- Dates et décomptes ---------------------------------------------------------------------

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 13 oct. », « 1er juin », « 28 nov. 2024 » : l'année quand elle diffère de `anneeCourante` (toujours si null). */
export function dateCourte(iso: string | null | undefined, anneeCourante: string | null): string {
  if (!iso) return "";
  const j = +iso.slice(8, 10);
  const an = anneeCourante && iso.slice(0, 4) === anneeCourante ? "" : ` ${iso.slice(0, 4)}`;
  return `${j === 1 ? "1er" : j} ${MOIS_COURT[+iso.slice(5, 7) - 1] ?? ""}${an}`;
}

const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 13 octobre 2026 ». */
export function dateLongue(iso: string | null | undefined): string {
  if (!iso) return "";
  const j = +iso.slice(8, 10);
  return `${j === 1 ? "1er" : j} ${MOIS_LONG[+iso.slice(5, 7) - 1] ?? ""} ${iso.slice(0, 4)}`;
}

/** « 503 pour · 0 contre · 67 abst. » : les trois positions, zéro compris (un zéro est une information). */
export function decompteCourt(v: { pour?: number | null; contre?: number | null; abstention?: number | null }): string {
  return `${fmt(v.pour ?? 0)} pour · ${fmt(v.contre ?? 0)} contre · ${fmt(v.abstention ?? 0)} abst.`;
}

// --- Statut d'un texte ----------------------------------------------------------------------

/**
 * Un texte sans vote sur l'ensemble est dit « en cours » quand son dernier scrutin public a moins
 * de 7 jours : l'examen en séance s'étale sur des jours consécutifs. Au-delà, on dit seulement
 * qu'il n'y a pas eu de vote sur l'ensemble en scrutin public (il a pu avoir lieu à main levée).
 * Exceptions, des votes qui closent l'examen : l'article unique (convention internationale), la
 * motion de censure (49.3), la motion de rejet préalable ou de renvoi adoptée.
 */
export const JOURS_EN_COURS = 7;

export type Statut =
  | { sort: Issue; label: string; decompte: string }
  | { sort: null; label: string; decompte: null };

const EN_COURS = "En cours : pas encore de vote sur l'ensemble";
const SANS_ENSEMBLE = "Pas de vote sur l'ensemble en scrutin public";

const verbe = (sort: Issue) => (sort === "adopte" ? "adopté" : "rejeté");

/** « Motion de rejet préalable rejetée », « Article unique adopté ». */
function libelleMarquant(r: VoteReference, sort: Issue): string {
  const fem = /^(motion|première|deuxième|troisième|quatrième)/i.test(r.objet ?? "");
  return `${r.objet ?? "Scrutin public"} ${verbe(sort)}${fem ? "e" : ""}`;
}

function statutSansEnsemble(t: Pick<TexteFil, "reference" | "derniereDate">, aujourdhui: string): Statut {
  const r = t.reference;
  const sort = r ? issueDe(r.sort_code) : null;
  // Ces votes CLOSENT l'examen : l'article unique (conventions, il EST le texte), une motion de
  // censure (49.3 : rejetée, le texte est adopté), une motion de rejet ou de renvoi adoptée.
  const clos =
    !!r && (r.objet === "Article unique" || r.nature === "censure" || (sort === "adopte" && /^Motion de (rejet|renvoi)/.test(r.objet ?? "")));
  if (!clos && t.derniereDate && t.derniereDate > ajouterJours(aujourdhui, -JOURS_EN_COURS)) return { sort: null, label: EN_COURS, decompte: null };
  if (r && sort) return { sort, label: libelleMarquant(r, sort), decompte: decompteCourt(r) };
  return { sort: null, label: SANS_ENSEMBLE, decompte: null };
}

/**
 * Statut d'un texte sur sa carte (listes) : « Adopté » + décompte du vote sur l'ensemble. Sans ce
 * vote : « En cours… » (texte récent), sinon le vote le plus marquant (motion, article unique),
 * sinon « Pas de vote sur l'ensemble en scrutin public ».
 */
export function statutCarte(t: Pick<TexteFil, "reference" | "derniereDate">, aujourdhui: string): Statut {
  const r = t.reference;
  const sort = r ? issueDe(r.sort_code) : null;
  if (r?.final && sort && r.nature !== "censure") return { sort, label: capitaliser(verbe(sort)), decompte: decompteCourt(r) };
  return statutSansEnsemble(t, aujourdhui);
}

/** Statut en tête de la page d'un texte : « Adopté en 1re lecture », « Texte de la CMP rejeté »… */
export function statutPage(t: Pick<TexteFil, "reference" | "derniereDate">, aujourdhui: string): Statut {
  const r = t.reference;
  const sort = r ? issueDe(r.sort_code) : null;
  if (r?.final && sort && r.nature !== "censure") {
    const l = r.lecture;
    const label = !l ? capitaliser(verbe(sort)) : l === "texte de la CMP" ? `Texte de la CMP ${verbe(sort)}` : `${capitaliser(verbe(sort))} en ${l}`;
    return { sort, label, decompte: decompteCourt(r) };
  }
  return statutSansEnsemble(t, aujourdhui);
}

/**
 * « 230 scrutins, dont 175 amendements et 54 articles » ; « 30 scrutins, tous sur des amendements » ;
 * null pour un texte d'un seul scrutin (le statut suffit). Un article isolé n'est pas cité.
 */
export function resumeScrutins(t: Pick<TexteFil, "nb" | "comptes">): string | null {
  if (t.nb <= 1) return null;
  const amd = t.comptes.amendement;
  const art = t.comptes.article + t.comptes.partie;
  if (amd === t.nb) return `${fmt(t.nb)} scrutins, tous sur des amendements`;
  const parts = [amd > 0 ? pl(amd, "amendement", "amendements") : null, art > 1 || (art > 0 && amd === 0) ? pl(art, "article", "articles") : null].filter(Boolean);
  return parts.length ? `${fmt(t.nb)} scrutins, dont ${parts.join(" et ")}` : `${fmt(t.nb)} scrutins`;
}

/** « 21 amendements qui ont compté » (null si aucun). */
export function libelleOntCompte(n: number): string | null {
  return n > 0 ? pl(n, "amendement qui a compté", "amendements qui ont compté") : null;
}

// --- Lignes de la page d'un texte -----------------------------------------------------------

/** « écart de 10 voix », « écart d'une voix », « à égalité » (pour contre contre, abstentions exclues). */
export function libelleEcart(s: Pick<ScrutinSrc, "pour" | "contre">): string {
  const e = Math.abs((s.pour ?? 0) - (s.contre ?? 0));
  if (e === 0) return "à égalité";
  return e === 1 ? "écart d'une voix" : `écart de ${fmt(e)} voix`;
}

/**
 * Pourquoi un amendement a compté, écrit sur sa ligne : « rétablit l'article 46 », « supprime
 * l'article 62 », « écart de 2 voix ». Vide pour un amendement qui ne répond pas au critère.
 */
export function raisonsEcrites(s: Pick<ScrutinSrc, "titre" | "type_vote" | "pour" | "contre" | "sort_code">): string[] {
  return raisonsCompte(s).map((r) => {
    if (r === "serre") return libelleEcart(s);
    const art = articleVise(s);
    const v = r === "suppression" ? "supprime" : "rétablit";
    return art ? `${v} l'article ${art}` : `${v} un article`;
  });
}

/**
 * Titre d'une ligne = ce qui a été voté (`ceQuiEstVote`, lot 2), sans le nom du texte déjà dit en
 * tête. Formules de procédure raccourcies (« et identiques », sans « (examen prioritaire) »). Avec
 * `raisonArticle`, l'objet « de rétablissement de l'article 46 (supprimé) » part : la raison écrite
 * sur la ligne le dit déjà.
 */
export function titreLigne(s: Pick<ScrutinSrc, "titre" | "type_vote">, raisonArticle = false): string {
  let t = ceQuiEstVote(s).titre
    .replace(/ et les amendements identiques suivants/i, " et identiques")
    .replace(/ et l'amendement identique suivant/i, " et identique")
    .replace(/\s*\(examen prioritaire\)/gi, "");
  // L'article et ses parenthèses de procédure (« (supprimé) », « (précédemment réservé) ») partent.
  if (raisonArticle) t = t.replace(/,? de (?:suppression|rétablissement) de l'article [^,(]+?(?:\s*\([^)]*\))*(?=$|,)/i, "");
  return t.trim();
}

const EST_LECTURE = /lecture|commission mixte/i;

/**
 * Ligne de méta d'un scrutin dans la page de son texte : « 13 oct. · rétablit l'article 46 ».
 * Ajoute la lecture quand elle diffère de celle du vote de référence (« 2e lecture ») et, sur
 * une ligne sans raison, ce que l'intitulé précise hors lecture (« seconde délibération »).
 */
export function metaLigne(
  s: Pick<ScrutinSrc, "titre" | "type_vote" | "date">,
  opts: { annee: string | null; lectureRef?: string | null; raisons?: string[] },
): string {
  const precisions = opts.raisons?.length ? [] : ceQuiEstVote(s).precisions.filter((p) => !EST_LECTURE.test(p)).map(minuscule);
  const l = lectureDe(s.titre ?? "");
  const lecture = l && opts.lectureRef && l !== opts.lectureRef ? [l] : [];
  return [dateCourte(s.date, opts.annee), ...precisions, ...lecture, ...(opts.raisons ?? [])].filter(Boolean).join(" · ");
}

/** Les scrutins d'un texte, rangés pour sa page (chaque liste du plus récent au plus ancien). */
export interface VentilationTexte {
  /** Amendements qui ont compté (critère mécanique). */
  comptent: ScrutinSrc[];
  /** Tous les amendements (et sous-amendements), comptent compris. */
  nbAmendements: number;
  /** Votes sur un article ou une partie du texte. */
  articles: ScrutinSrc[];
  /** Amendements qui ne répondent pas au critère. */
  autresAmendements: ScrutinSrc[];
  /** Le reste : votes sur l'ensemble d'autres lectures, motions, procédure. */
  autres: ScrutinSrc[];
}

const recent = (a: ScrutinSrc, b: ScrutinSrc) => (b.date ?? "").localeCompare(a.date ?? "") || (b.numero ?? 0) - (a.numero ?? 0);

/** Range les scrutins d'un texte. Le vote de référence (`refUid`, affiché en tête) n'est pas répété. */
export function ventilerTexte(scrs: ScrutinSrc[], refUid: string | null): VentilationTexte {
  const v: VentilationTexte = { comptent: [], nbAmendements: 0, articles: [], autresAmendements: [], autres: [] };
  for (const s of [...scrs].sort(recent)) {
    if (s.uid === refUid) continue;
    const n = natureScrutin(s);
    if (n === "amendement") {
      v.nbAmendements += 1;
      (raisonsCompte(s).length ? v.comptent : v.autresAmendements).push(s);
    } else if (n === "article" || n === "partie") v.articles.push(s);
    else v.autres.push(s);
  }
  return v;
}

/** « 53 adoptés, 1 rejeté ». */
export function resumeSorts(l: Pick<ScrutinSrc, "sort_code">[]): string {
  const a = l.filter((s) => issueDe(s.sort_code) === "adopte").length;
  const r = l.length - a;
  return [a ? pl(a, "adopté", "adoptés") : null, r ? pl(r, "rejeté", "rejetés") : null].filter(Boolean).join(", ");
}

// --- Recherche regroupée par texte ----------------------------------------------------------

/** Intitulés normalisés, calculés une fois par scrutin (la recherche relit tout l'index à chaque frappe). */
const titresNorm = new WeakMap<object, string>();
function titreNorm(o: { titre: string | null }): string {
  let t = titresNorm.get(o);
  if (t === undefined) {
    t = normaliser(o.titre ?? "");
    titresNorm.set(o, t);
  }
  return t;
}

export interface TexteTrouve {
  texte: TexteFil;
  /** Scrutins de ce texte dont l'intitulé cite la recherche. */
  citations: number;
}

export interface ResultatTextes {
  /** Textes dont l'intitulé, ou celui d'un de leurs scrutins, cite la recherche (récents d'abord). */
  textes: TexteTrouve[];
  /** Tous les scrutins dont l'intitulé cite la recherche (récents d'abord). */
  scrutins: ScrutinSrc[];
}

/**
 * Recherche exacte REGROUPÉE PAR TEXTE : même règle que la recherche historique (`rechercher`,
 * api.ts : intitulé normalisé qui contient la saisie), appliquée à TOUS les scrutins, puis
 * rangée par texte. Un texte dont seul l'intitulé du dossier cite la recherche compte aussi.
 */
export function rechercherTextes(q: string, index: IndexTextes): ResultatTextes {
  const terme = normaliser(q);
  if (terme.length < 2) return { textes: [], scrutins: [] };
  const scrutins: ScrutinSrc[] = [];
  const citations = new Map<string, number>();
  for (const [cle, scrs] of index.scrutinsDe) {
    for (const s of scrs) {
      if (!titreNorm(s).includes(terme)) continue;
      scrutins.push(s);
      citations.set(cle, (citations.get(cle) ?? 0) + 1);
    }
  }
  const textes: TexteTrouve[] = [];
  for (const t of index.textes) {
    const n = citations.get(t.cle) ?? 0;
    if (n > 0 || titreNorm(t).includes(terme)) textes.push({ texte: t, citations: n });
  }
  textes.sort((a, b) => ordreRecent(a.texte, b.texte));
  return { textes, scrutins: scrutins.sort(recent) };
}

/**
 * Phrase de résultat : « 3 textes et 49 scrutins parlent de retraite. Aucun député ne porte ce nom. »
 * Sans `nbDeputes` (députés pas encore chargés), seule la première phrase.
 */
export function phraseResultats(nbTextes: number, nbScrutins: number, terme: string, nbDeputes?: number | null): string {
  const t = terme.trim();
  const de = /^[aeiouyéèêëàâîïôöûüœ]/i.test(t) ? `d'${t}` : `de ${t}`; // « parlent d'écologie »
  let p: string;
  if (!nbTextes && !nbScrutins) p = `Aucun texte ne parle ${de}.`;
  else if (!nbScrutins) p = `${pl(nbTextes, "texte", "textes")} ${nbTextes > 1 ? "parlent" : "parle"} ${de}.`;
  else p = `${pl(nbTextes, "texte", "textes")} et ${pl(nbScrutins, "scrutin", "scrutins")} parlent ${de}.`;
  if (nbDeputes == null) return p;
  const d = nbDeputes === 0 ? "Aucun député ne porte ce nom." : `${pl(nbDeputes, "député correspond", "députés correspondent")} à ta recherche.`;
  return `${p} ${d}`;
}
