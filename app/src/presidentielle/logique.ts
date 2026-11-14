// Rubrique Présidentielle 2027 : logique pure (sans React Native), partagée par l'app et par
// l'export du pipeline. Testée dans presidentielle.test.ts.
import type {
  Comptes, Famille, Filtre, IndexPresidentielle, MesureLegere, Perimetre, Programme, ProgrammeResume,
  ScrutinConfronte, SousNeutre, Statut,
} from "./types";

export const INDEX_VIDE: IndexPresidentielle = { generatedAt: "", programmes: [] };

/** Garde de forme : un fichier altéré ou d'un autre format vaut « aucun programme ». */
export function indexValide(x: unknown): IndexPresidentielle {
  const o = x as IndexPresidentielle | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.programmes)) return INDEX_VIDE;
  const programmes = o.programmes.filter(
    (p) => p && typeof p.id === "string" && /^[a-z0-9-]+$/.test(p.id) && typeof p.publieLe === "string" && Array.isArray(p.alias),
  );
  return { generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : "", programmes };
}

export const COMPTES_VIDES: Comptes = { c: 0, t: 0, s: 0, j: 0, r: 0 };

/** Famille publique d'un statut ; null pour le hors champ (jamais compté dans les verdicts). */
export function familleDe(s: Statut): Famille | null {
  if (s === "c") return "c";
  if (s === "t") return "t";
  if (s === "h") return null;
  return "n";
}

export function comptesDe(statuts: Iterable<Statut>): Comptes {
  const k = { ...COMPTES_VIDES };
  for (const s of statuts) if (s !== "h") k[s]++;
  return k;
}

export const neutres = (k: Comptes) => k.s + k.j + k.r;
export const confrontables = (k: Comptes) => k.c + k.t + k.s + k.j + k.r;

/** Le statut passe-t-il le filtre (et la puce de sous-cas du neutre) ? */
export function correspond(s: Statut, filtre: Filtre, sous: SousNeutre = "tout"): boolean {
  const f = familleDe(s);
  if (f === null) return false;
  if (filtre === "toutes") return true;
  if (filtre !== f) return false;
  if (f === "n" && sous !== "tout") return s === sous;
  return true;
}

/** Mesures confrontables d'un périmètre (hors champ exclus). « ch » : les lignes chiffrées. */
export function statutsDuPerimetre(p: Programme, perimetre: Perimetre): Statut[] {
  if (perimetre === "ch") return p.listeChiffrees.map((l) => l.statut);
  return p.listeMesures.filter((m) => m.statut !== "h" && (perimetre === "all" || m.cle)).map((m) => m.statut);
}

export function mesuresDuChapitre(p: Programme, chapitre: string): MesureLegere[] {
  return p.listeMesures.filter((m) => m.chapitre === chapitre);
}

/** Les programmes du plus récent au plus ancien (date de publication), puis par id. */
export function ordonnerProgrammes(programmes: ProgrammeResume[]): ProgrammeResume[] {
  return [...programmes].sort((a, b) => (a.publieLe === b.publieLe ? a.id.localeCompare(b.id) : a.publieLe < b.publieLe ? 1 : -1));
}

/** La rubrique est-elle visible ? Seulement si au moins un programme est en service. */
export function rubriqueVisible(index: IndexPresidentielle | null | undefined): boolean {
  return !!index && Array.isArray(index.programmes) && index.programmes.length > 0;
}

/** Programme par id ou alias (« lfi » → « lfi-2027 »), parmi ceux en service. */
export function resoudreProgramme(index: IndexPresidentielle | null | undefined, cle: string): ProgrammeResume | null {
  if (!rubriqueVisible(index)) return null;
  const k = cle.trim().toLowerCase();
  return index!.programmes.find((p) => p.id === k) ?? index!.programmes.find((p) => p.alias.includes(k)) ?? null;
}

/** Programme en service confronté au groupe `groupeUid` (fiche parti → sous-onglet). */
export function programmeDuGroupe(index: IndexPresidentielle | null | undefined, groupeUid: string): ProgrammeResume | null {
  if (!rubriqueVisible(index)) return null;
  return ordonnerProgrammes(index!.programmes).find((p) => p.groupe?.uid === groupeUid) ?? null;
}

/** Cible d'un lien profond de la rubrique. Les routes elles-mêmes sont construites par l'app. */
export type CibleLien =
  | { ecran: "presidentielle" }
  | { ecran: "programme"; programme: string }
  | { ecran: "chapitre"; programme: string; chapitre: string }
  | { ecran: "mesure"; programme: string; mesure: string };

/** Types de `?open=` gérés par la rubrique. */
export const TYPES_LIEN = ["presidentielle", "programme", "chapitre", "mesure"] as const;

/**
 * `?open=…` → écran de la rubrique, ou null (rubrique hors service, programme inconnu, forme
 * invalide) : l'app reste alors sur l'accueil, sans message d'erreur.
 *  presidentielle · programme:lfi-2027 (ou alias) · chapitre:lfi-2027.p2c2 · mesure:lfi-2027.p3c1-046 / .D13
 * L'existence du chapitre ou de la mesure est vérifiée par l'écran, qui retombe sur l'accueil.
 */
export function cibleLienProfond(open: string, index: IndexPresidentielle | null | undefined): CibleLien | null {
  if (!rubriqueVisible(index)) return null;
  const i = open.indexOf(":");
  const type = (i < 0 ? open : open.slice(0, i)).trim();
  const reste = i < 0 ? "" : open.slice(i + 1).trim();
  if (type === "presidentielle") return { ecran: "presidentielle" };
  if (type === "programme") {
    const p = resoudreProgramme(index, reste);
    return p ? { ecran: "programme", programme: p.id } : null;
  }
  if (type === "chapitre" || type === "mesure") {
    const pt = reste.indexOf(".");
    if (pt <= 0) return null;
    const p = resoudreProgramme(index, reste.slice(0, pt));
    const sous = reste.slice(pt + 1);
    if (!p || !/^[A-Za-z0-9-]{1,40}$/.test(sous)) return null;
    return type === "chapitre"
      ? { ecran: "chapitre", programme: p.id, chapitre: sous }
      : { ecran: "mesure", programme: p.id, mesure: sous };
  }
  return null;
}

/** Valeur `open` d'un lien de partage (inverse de cibleLienProfond). */
export function valeurOpen(c: CibleLien): string {
  if (c.ecran === "presidentielle") return "presidentielle";
  if (c.ecran === "programme") return `programme:${c.programme}`;
  if (c.ecran === "chapitre") return `chapitre:${c.programme}.${c.chapitre}`;
  return `mesure:${c.programme}.${c.mesure}`;
}

/** Une mesure d'un programme, ou une ligne du chiffrage (code R01…/D01…). */
export const estCodeChiffrage = (id: string) => /^[RD]\d{2}$/.test(id);

// ---------------------------------------------------------------------------------------------
// Scrutins d'une mesure : répartition et regroupement.

export interface RepartitionScrutins {
  ecarts: ScrutinConfronte[]; // effet t : s'écartent de la mesure (cartes complètes)
  aJuger: ScrutinConfronte[]; // effet j : faits, sans verdict
  sens: ScrutinConfronte[]; // effet c : vont dans son sens (liste compacte)
  sansEffet: ScrutinConfronte[]; // r, o, x : affichés, sans effet sur le verdict
}

/** Date décroissante, puis numéro décroissant. Aucun autre ordre, aucun lien entre scrutins. */
export function trierScrutins(l: ScrutinConfronte[]): ScrutinConfronte[] {
  return [...l].sort((a, b) => (a.date === b.date ? b.numero - a.numero : a.date < b.date ? 1 : -1));
}

export function repartir(scrutins: ScrutinConfronte[]): RepartitionScrutins {
  const t = trierScrutins(scrutins);
  return {
    ecarts: t.filter((s) => s.effet === "t"),
    aJuger: t.filter((s) => s.effet === "j"),
    sens: t.filter((s) => s.effet === "c"),
    sansEffet: t.filter((s) => s.effet === "r" || s.effet === "o" || s.effet === "x"),
  };
}

/** Clé « même texte » : le dossier s'il est connu, sinon la fin de l'intitulé qui nomme le texte. */
export function cleTexte(s: ScrutinConfronte): string | null {
  if (s.dossier) return `d:${s.dossier}`;
  const m = s.intitule.match(/\b(du projet de loi|de la proposition de loi|de la proposition de résolution|du projet de loi organique|de la proposition de loi organique)\b.*$/i);
  return m ? `i:${m[0].trim().toLowerCase()}` : null;
}

export interface GroupeScrutins {
  cle: string;
  date: string;
  scrutins: ScrutinConfronte[];
  /** Fin d'intitulé commune à tous les scrutins du groupe (texte officiel, mot pour mot). */
  communFin: string | null;
}

export type ElementListe = { seul: ScrutinConfronte } | { groupe: GroupeScrutins };

/** Plus longue fin commune, recoupée au début d'un mot ; null si trop courte pour dire le texte. */
export function finCommune(textes: string[]): string | null {
  if (!textes.length) return null;
  let n = textes[0].length;
  for (const t of textes.slice(1)) {
    let i = 0;
    while (i < n && i < t.length && textes[0][textes[0].length - 1 - i] === t[t.length - 1 - i]) i++;
    n = i;
  }
  const ref = textes[0];
  let debut = ref.length - n;
  // Recaler au début d'un mot : si la fin commune coupe un mot, on saute jusqu'à l'espace suivant.
  if (debut > 0 && !/\s/.test(ref[debut - 1])) {
    const sp = ref.slice(debut).search(/\s/);
    if (sp < 0) return null;
    debut += sp;
  }
  let fin = ref.slice(debut).trim();
  // Commencer au repère du texte (« à l'article… », « du projet de loi… ») plutôt qu'au milieu
  // d'un nom d'auteur commun à tout le lot.
  const repere = fin.search(/(?:^|\s)(?:(?:à|après|avant) l['’](?:article|annexe|intitulé)|(?:du|de la) (?:projet|proposition))/);
  if (repere > 0) fin = fin.slice(repere).trim();
  return fin.length >= 24 ? fin : null;
}

/**
 * Liste compacte : les scrutins d'un même texte, du même jour, du même effet, du même sens et
 * de la même position du groupe se regroupent (2 ou plus) sur une ligne dépliable. Ordre :
 * date décroissante ; un groupe prend la place de son premier scrutin.
 */
export function regrouper(scrutins: ScrutinConfronte[]): ElementListe[] {
  const tries = trierScrutins(scrutins);
  const parCle = new Map<string, ScrutinConfronte[]>();
  const cleDe = (s: ScrutinConfronte) => {
    const t = cleTexte(s);
    return t ? [t, s.date, s.effet, s.sens, s.position].join("|") : null;
  };
  for (const s of tries) {
    const k = cleDe(s);
    if (!k) continue;
    parCle.set(k, [...(parCle.get(k) ?? []), s]);
  }
  const out: ElementListe[] = [];
  const vus = new Set<string>();
  for (const s of tries) {
    const k = cleDe(s);
    const g = k ? parCle.get(k)! : null;
    if (!k || !g || g.length < 2) {
      out.push({ seul: s });
      continue;
    }
    if (vus.has(k)) continue;
    vus.add(k);
    out.push({ groupe: { cle: k, date: s.date, scrutins: g, communFin: finCommune(g.map((x) => x.intitule)) } });
  }
  return out;
}

/** Le groupe n'a-t-il eu aucun votant sur ce scrutin ? */
export const sansVotant = (s: ScrutinConfronte) => s.votants === 0;
