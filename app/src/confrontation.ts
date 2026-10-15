// Face à face de deux élus : chiffres, derniers votes et thèmes en barres papillon, LOGIQUE PURE
// (aucun import RN), testée hors app (`confrontation.test.ts`, garde de refresh.yml).
// Maquette validée le 15/10/2026 : `maquette-face-a-face-duel.html`.
//
// Tout part de `getConfrontation` (api.ts), sans autre règle : un vote « en commun » est un scrutin
// rattaché à un thème où les DEUX ont exprimé une position (pour, contre ou abstention). « Pareils » =
// même position, « opposés » = positions différentes (une abstention face à un pour compte comme
// opposé). Rien n'est recalculé ici : on range, on compte et on écrit.

import { ceQuiEstVote, type NatureVote } from "./typeScrutin";
import { dateCourte } from "./textes";
import type { ConfrontationScrutin, ConfrontationTheme } from "./types";

/** Part d'accord arrondie (69 pour 232 sur 337), null sans vote en commun. */
export function tauxAccord(pareils: number, communs: number): number | null {
  return communs > 0 ? Math.round((pareils / communs) * 100) : null;
}

/** Sous l'anneau : « 232 votes pareils sur 337 en commun ». */
export function phraseBandeau(pareils: number, communs: number): string {
  if (communs === 0) return "Aucun vote en commun sur cette période";
  return `${pareils} vote${pareils > 1 ? "s" : ""} pareil${pareils > 1 ? "s" : ""} sur ${communs} en commun`;
}

/** Plus récent d'abord (date, puis numéro de scrutin) ; stable pour une même entrée. */
const recentDabord = (a: ConfrontationScrutin, b: ConfrontationScrutin) =>
  (b.date ?? "").localeCompare(a.date ?? "") || (b.numero ?? 0) - (a.numero ?? 0);

/** Tous les votes en commun, tous thèmes confondus, du plus récent au plus ancien. */
export function votesCommuns(themes: Pick<ConfrontationTheme, "accords" | "desaccords">[]): ConfrontationScrutin[] {
  const out: ConfrontationScrutin[] = [];
  for (const t of themes) out.push(...t.accords, ...t.desaccords);
  return out.sort(recentDabord);
}

/** Les `n` derniers votes en commun (la section « Derniers votes »). */
export function derniersVotes(themes: Pick<ConfrontationTheme, "accords" | "desaccords">[], n = 3): ConfrontationScrutin[] {
  return votesCommuns(themes).slice(0, n);
}

/** Une ligne de thème : pareils à gauche, opposés à droite, % d'accord. */
export interface LigneTheme {
  id: string;
  libelle: string;
  pareils: number;
  opposes: number;
  communs: number;
  pct: number; // part de pareils, arrondie
}

/**
 * Thèmes rangés pour l'écran : au-dessus du seuil, du plus divergent au plus convergent (barres
 * papillon) ; sous le seuil mais avec des votes, « trop peu » (ligne grise) ; sans aucun vote commun
 * à part. Un silence n'est pas un désaccord : ces deux derniers groupes ne sont jamais des barres.
 */
export function ventilerThemes(themes: ConfrontationTheme[], seuil: number): { fiables: LigneTheme[]; peu: LigneTheme[]; aucun: LigneTheme[] } {
  const lignes = themes.map((t) => {
    const pareils = t.accords.length;
    const opposes = t.desaccords.length;
    return { id: t.id, libelle: t.libelle, pareils, opposes, communs: t.communs, pct: tauxAccord(pareils, t.communs) ?? 0 };
  });
  return {
    fiables: lignes.filter((l) => l.communs >= seuil).sort((a, b) => a.pct - b.pct || b.communs - a.communs || a.libelle.localeCompare(b.libelle, "fr")),
    peu: lignes.filter((l) => l.communs > 0 && l.communs < seuil).sort((a, b) => b.communs - a.communs || a.libelle.localeCompare(b.libelle, "fr")),
    aucun: lignes.filter((l) => l.communs === 0),
  };
}

/** Longueur de chaque aile de la barre papillon, en % de sa moitié (somme = 100). */
export function ailesPapillon(pareils: number, opposes: number): { gauche: number; droite: number } {
  const total = pareils + opposes;
  if (!total) return { gauche: 0, droite: 0 };
  const gauche = Math.round((pareils / total) * 100);
  return { gauche, droite: 100 - gauche };
}

/**
 * Ligne grise sous les thèmes : « Trop peu de votes communs pour conclure : International (4),
 * Travail (3). Aucun vote commun : Éducation. Ce n'est pas un désaccord. » null s'il n'y a rien.
 */
export function phraseHorsSeuil(peu: { libelle: string; communs: number }[], aucun: { libelle: string }[]): string | null {
  const parts: string[] = [];
  if (peu.length) parts.push(`Trop peu de votes communs pour conclure : ${peu.map((t) => `${t.libelle} (${t.communs})`).join(", ")}.`);
  if (aucun.length) parts.push(`Aucun vote commun : ${aucun.map((t) => t.libelle).join(", ")}.`);
  if (!parts.length) return null;
  return `${parts.join(" ")} Ce n'est pas un désaccord.`;
}

/** Libellé court d'une position dans les pastilles en colonnes. */
export function positionCourte(p: string): string {
  return p === "pour" ? "Pour" : p === "contre" ? "Contre" : p === "abstention" ? "Abst." : "—";
}

// Natures au féminin (« la motion … rejetée »), pour accorder l'issue.
const FEMININ: NatureVote[] = ["motion", "censure", "partie", "declaration", "procedure"];

/** Lettre initiale en capitale ; retire le déterminant de tête et les parenthèses finales. */
function intituleNettoye(titre: string): string {
  let t = titre.replace(/[’`]/g, "'").replace(/\s+/g, " ").trim().replace(/[\s.;]+$/, "");
  while (/\([^()]*\)$/.test(t)) t = t.replace(/\s*\([^()]*\)$/, "");
  t = t.replace(/^(sur )?(l'|le |la |les )/i, "");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Une ligne de « Derniers votes » : méta (« Motion · 13 oct. · rejetée ») et titre. Le titre dit ce
 * qui a été voté (lot 2, `ceQuiEstVote`) : pour un vote sur l'ensemble, le nom du texte ; pour une
 * motion, l'intitulé officiel avec le texte visé (sinon on ne sait pas sur quel texte), sans l'incise
 * sur son auteur ; sinon l'objet voté.
 */
export function ligneVote(
  sc: Pick<ConfrontationScrutin, "titre" | "objet" | "date" | "sort_code" | "type_vote" | "dossier_titre">,
  anneeCourante: string | null,
): { meta: string; titre: string } {
  const cqv = ceQuiEstVote({ titre: sc.titre ?? sc.objet, type_vote: sc.type_vote });
  const ensemble = cqv.nature === "ensemble" || (cqv.nature === "partie" && cqv.titre.startsWith("Vote sur l'ensemble"));
  const titre = ensemble
    ? sc.dossier_titre || cqv.texte || cqv.titre
    : cqv.nature === "motion"
      ? // « Motion de rejet préalable, déposée par M. X, du projet de loi … » : l'incise sur l'auteur
        // part (découpe, pas reformulation) pour que le texte visé tienne sur deux lignes.
        intituleNettoye(sc.titre ?? sc.objet ?? "").replace(/, (?:déposée|présentée) par [^,]+,/, "") || cqv.titre
      : cqv.nature === "censure"
        ? intituleNettoye(sc.titre ?? sc.objet ?? "") || cqv.titre
        : cqv.titre;
  const fem = FEMININ.includes(cqv.nature) && !ensemble;
  const issue = sc.sort_code === "adopte" ? (fem ? "adoptée" : "adopté") : sc.sort_code === "rejete" ? (fem ? "rejetée" : "rejeté") : null;
  const meta = [ensemble ? "Vote sur l'ensemble" : cqv.etiquette, dateCourte(sc.date, anneeCourante), issue].filter(Boolean).join(" · ");
  return { meta, titre };
}
