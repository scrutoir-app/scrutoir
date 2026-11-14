// Rubrique Présidentielle 2027 : libellés publics (purs, testés). Règles : des nombres, jamais
// de pourcentage ; une tension est un écart à débattre, pas une contradiction ; les intitulés
// officiels et les textes des mesures sont recopiés tels quels, jamais résumés.
import type { Comptes, Effet, Famille, PositionGroupe, ScrutinConfronte, Statut } from "./types";
import { neutres } from "./logique";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** 1069 → « 1 069 » (espace insécable, à la française). */
export function nombre(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** « 2026-11-06 » → « 6 novembre 2026 » (« 1er » le premier du mois). */
export function dateLongue(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const j = Number(m[3]);
  return `${j === 1 ? "1er" : j} ${MOIS[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

export const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

export const GLYPHE: Record<Famille, string> = { c: "=", t: "≠", n: "∅" };

export function familleStatut(s: Statut): Famille {
  return s === "c" ? "c" : s === "t" ? "t" : "n";
}

/** Libellé d'un statut, tel qu'il s'affiche sous une mesure. */
export const MOT_STATUT: Record<Statut, string> = {
  c: "Cohérent",
  t: "Tension",
  s: "Sans scrutin public",
  j: "À juger",
  r: "Sans vote représentatif",
  h: "Hors champ",
};

/** Phrase d'explication des puces du neutre. */
export const EXPLICATION_NEUTRE = {
  tout: "Ni cohérentes ni en tension : aucun verdict n’est donné sur ces mesures.",
  s: "Aucun scrutin public de cette législature ne porte la mesure. Un silence n’est pas un désaccord.",
  j: "Le même sens se discute. Les faits sont là, le verdict revient au lecteur.",
  r: "Trois députés du groupe ou moins ont voté. Le vote est affiché, il ne vaut pas verdict.",
} as const;

export const PHRASE_TENSION = "Une tension est un écart à débattre, pas une contradiction.";
export const PHRASE_NON_PARTICIPATION = "Ne pas prendre part au vote est une façon de ne pas voter un texte, sans voter contre.";
export const PHRASE_MONTANTS = "Les montants ne sont pas repris ici : Scrutoir compare aux votes, il ne chiffre pas.";

/** « = 12  ≠ 4  ∅ 30 » (espaces insécables doublés entre les comptes). */
export function ligneComptes(k: Comptes, sep = "  "): string {
  return [`= ${nombre(k.c)}`, `≠ ${nombre(k.t)}`, `∅ ${nombre(neutres(k))}`].join(sep).replace(/ /g, " ");
}

/** Comptes en toutes lettres, pour les lecteurs d'écran. */
export function comptesEnLettres(k: Comptes): string {
  return `${nombre(k.c)} ${pluriel(k.c, "cohérente", "cohérentes")}, ${nombre(k.t)} en tension, ${nombre(neutres(k))} ${pluriel(neutres(k), "neutre", "neutres")}`;
}

/** Détail du neutre : « 25 sans scrutin public · 4 à juger · 1 sans vote représentatif ». */
export function detailNeutre(k: Comptes): string {
  return (
    [
      [k.s, "sans scrutin public"],
      [k.j, "à juger"],
      [k.r, "sans vote représentatif"],
    ] as [number, string][]
  )
    .filter(([n]) => n > 0)
    .map(([n, l]) => `${nombre(n)} ${l}`)
    .join(" · ");
}

/** Annonce polie après filtrage : « 33 mesures affichées ». */
export function annonceFiltre(n: number, unite: "mesure" | "ligne" = "mesure"): string {
  if (n === 0) return unite === "ligne" ? "Aucune ligne affichée" : "Aucune mesure affichée";
  return `${nombre(n)} ${unite}${n > 1 ? "s" : ""} ${pluriel(n, "affichée", "affichées")}`;
}

export function libelleScrutinsPublics(n: number): string {
  return `${nombre(n)} ${pluriel(n, "scrutin public", "scrutins publics")}`;
}

/** Méta sous une mesure dans une liste : « Tension · 3 scrutins publics ». */
export function metaMesure(statut: Statut, nScrutins: number): string {
  if ((statut === "c" || statut === "t" || statut === "j") && nScrutins > 0) return `${MOT_STATUT[statut]} · ${libelleScrutinsPublics(nScrutins)}`;
  return MOT_STATUT[statut];
}

export const sortLibelle = (s: ScrutinConfronte["sort"]) => (s === "adopte" ? "Adopté" : "Rejeté");
export const sensLibelle = (s: ScrutinConfronte["sens"]) => (s === "meme" ? "Même sens que la mesure" : "Sens inverse de la mesure");

/** Intitulé officiel, mot pour mot, précédé du « Sur » de l'Assemblée. */
export function intituleAffiche(s: Pick<ScrutinConfronte, "intitule">): string {
  const t = s.intitule.trim();
  return /^sur\b/i.test(t) ? t[0].toUpperCase() + t.slice(1) : `Sur ${t}`;
}

/** Phrase du verdict d'une mesure, avec ses nombres (jamais de part ni de pourcentage). */
export function phraseVerdict(statut: Statut, scrutins: Pick<ScrutinConfronte, "effet" | "votants">[]): string {
  const n = scrutins.length;
  const cpt = (e: Effet[]) => scrutins.filter((s) => e.includes(s.effet)).length;
  const t = cpt(["t"]), c = cpt(["c"]), j = cpt(["j"]), z = cpt(["r", "o", "x"]);
  const reste: string[] = [];
  const autres = (k: number, phraseSeule: string, phraseListe: string) => ({ k, phraseSeule, phraseListe });
  const parts = [
    autres(c, `${pluriel(c, "L’autre va", `Les ${nombre(c)} autres vont`)} dans son sens.`, `${nombre(c)} ${pluriel(c, "va", "vont")} dans son sens`),
    autres(j, `${pluriel(j, "L’autre est à juger", `Les ${nombre(j)} autres sont à juger`)}.`, `${nombre(j)} ${pluriel(j, "est", "sont")} à juger`),
    autres(z, `${pluriel(z, "L’autre est sans effet", `Les ${nombre(z)} autres sont sans effet`)} sur le verdict.`, `${nombre(z)} ${pluriel(z, "est", "sont")} sans effet sur le verdict`),
  ].filter((p) => p.k > 0);
  if (statut === "t") {
    const tousSansVotant = t > 0 && scrutins.filter((s) => s.effet === "t").every((s) => s.votants === 0);
    const tete = `${nombre(t)} ${pluriel(t, "des", "des")} ${nombre(n)} scrutins retenus ${pluriel(t, "s’écarte", "s’écartent")} de la mesure${tousSansVotant ? ` : le groupe n’y a pas pris part` : ""}.`;
    if (n === t) return t === 1 ? `Le seul scrutin retenu s’écarte de la mesure${tousSansVotant ? " : le groupe n’y a pas pris part" : ""}.` : tete;
    if (parts.length === 1) return `${tete} ${parts[0].phraseSeule}`;
    reste.push(...parts.map((p) => p.phraseListe));
    return `${tete} Parmi les autres : ${reste.join(", ")}.`;
  }
  if (statut === "c") {
    if (n === 1) return "Le seul scrutin retenu va dans le sens de la mesure.";
    if (c === n) return `Les ${nombre(n)} scrutins retenus vont dans le sens de la mesure.`;
    return `${nombre(c)} des ${nombre(n)} scrutins retenus vont dans le sens de la mesure. ${nombre(n - c)} ${pluriel(n - c, "est", "sont")} sans effet sur le verdict.`;
  }
  if (statut === "j") return "Le même sens se discute. Voici les faits, sans verdict : à chacun de juger.";
  if (statut === "r") return "Trois députés du groupe ou moins ont voté. Le vote est affiché, il ne vaut pas verdict.";
  if (statut === "s") return "Aucun scrutin public de cette législature ne porte la mesure. Un silence n’est pas un désaccord.";
  return "Aucun vote de l’Assemblée ne peut porter cette mesure.";
}

/** Position du groupe en mots (pour les lignes regroupées et les lecteurs d'écran). */
export function positionEnMots(p: PositionGroupe): string {
  return p === "pour" ? "vote pour" : p === "contre" ? "vote contre" : p === "abstention" ? "s’abstient" : p === "partage" ? "se partage" : "ne prend pas part au vote";
}

/** Ligne regroupée : « Le groupe vote contre les 12 ». */
export function phraseGroupe(p: PositionGroupe, n: number): string {
  const nb = nombre(n);
  if (p === "pour") return `Le groupe vote pour les ${nb}`;
  if (p === "contre") return `Le groupe vote contre les ${nb}`;
  if (p === "abstention") return `Le groupe s’abstient sur les ${nb}`;
  if (p === "partage") return `Le groupe se partage sur les ${nb}`;
  return `Aucun député du groupe n’a pris part aux ${nb}`;
}

/** Résultat d'un lot : « tous rejetés », « tous adoptés », « 3 adoptés, 9 rejetés ». */
export function sortsDuLot(l: Pick<ScrutinConfronte, "sort">[]): string {
  const a = l.filter((s) => s.sort === "adopte").length;
  const r = l.length - a;
  if (a === 0) return l.length === 2 ? "tous deux rejetés" : "tous rejetés";
  if (r === 0) return l.length === 2 ? "tous deux adoptés" : "tous adoptés";
  return `${nombre(a)} ${pluriel(a, "adopté", "adoptés")}, ${nombre(r)} ${pluriel(r, "rejeté", "rejetés")}`;
}

/** Titre d'un lot : « 12 amendements du 28 novembre 2024 » (« scrutins » si pas tous des amendements). */
export function titreLot(l: Pick<ScrutinConfronte, "intitule" | "date">[]): string {
  const amdts = l.every((s) => /^(l[’']|le |les )?(sous-)?amendements?\b/i.test(s.intitule.trim()) || /^l[’']amendement|^le sous-amendement|^les amendements/i.test(s.intitule.trim()));
  return `${nombre(l.length)} ${amdts ? "amendements" : "scrutins"} du ${dateLongue(l[0]?.date)}`;
}

/** Explication d'un scrutin sans effet sur le verdict. */
export function phraseSansEffet(s: Pick<ScrutinConfronte, "effet" | "votants" | "position">): string | null {
  if (s.effet === "r") return `${s.votants > 1 ? `Seuls ${nombre(s.votants)} députés du groupe ont voté` : "Un seul député du groupe a voté"} : position non représentative, sans effet sur le verdict.`;
  if (s.effet === "o") return "Abstention sur un texte de sens inverse déposé par un autre groupe : sans effet sur le verdict.";
  if (s.effet === "x") return `${PHRASE_NON_PARTICIPATION} Sur un texte de sens inverse, la méthode ne compte pas ce cas en tension.`;
  return null;
}

/** Alerte affichée sur un scrutin. */
export const TEXTE_ALERTE = {
  "intitule-seul": "⚠ Rapproché sur son seul intitulé : le texte de la résolution n’est pas dans la base.",
  "auteur-du-groupe": "⚠ Amendement déposé par un député du groupe, qui a voté contre : relevé officiel à vérifier.",
} as const;

/** Libellé d'un décompte pour lecteur d'écran. */
export function decompteEnLettres(s: Pick<ScrutinConfronte, "pour" | "contre" | "abstention" | "votants">): string {
  if (s.votants === 0) return "Aucun député du groupe n’a pris part au vote";
  return `Vote du groupe : ${nombre(s.pour)} pour, ${nombre(s.contre)} contre, ${nombre(s.abstention)} abstention${s.abstention > 1 ? "s" : ""}, ${nombre(s.votants)} ${pluriel(s.votants, "votant", "votants")}`;
}
