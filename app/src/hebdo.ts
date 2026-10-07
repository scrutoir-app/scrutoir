// Édition hebdomadaire « La semaine à l'Assemblée » : calcul 100 % client, fonctions pures
// (testées par `hebdo.test.ts`). Aucune donnée nouvelle : on relit `scrutins.json` (date, texte
// rattaché, type de vote, thème) et `dossiers.json` (intitulé officiel du texte).
//
// PARUTION. Une édition paraît chaque VENDREDI et couvre les sept jours qui précèdent, du
// vendredi J-7 au jeudi J-1. Chaque scrutin appartient à UNE seule édition : celle du premier
// vendredi strictement postérieur à sa date (un vote du vendredi part dans l'édition suivante).
// Si l'AN publie un scrutin en retard, il rejoint son édition au refresh suivant.
//
// NEUTRALITÉ (non négociable). L'édition dit SUR QUOI l'Assemblée a voté, jamais ce que ça
// veut dire : aucun « comme toi », aucun camp, aucune couleur de parti. Aucun résultat dans la
// semaine ; le seul fait de résultat affiché (dans le focus) est l'issue du vote sur l'ensemble
// d'un texte, telle que publiée par l'AN. Le classement des sujets repose sur des critères
// objectifs (scrutin solennel, motion de censure, vote sur l'ensemble, nombre de scrutins
// publics), jamais sur un jugement éditorial.
//
// HONNÊTETÉ. On parle de « scrutins publics », jamais « des amendements du texte » : la plupart
// des votes se font à main levée et ne laissent pas de trace nominative.

export interface ScrutinSrc {
  uid: string;
  numero: number | null;
  date: string | null;
  titre: string | null;
  sort_code: string | null;
  type_vote?: string | null;
  dossier_ref?: string | null;
  categorie?: string | null;
}

export interface DossierSrc {
  ref: string;
  titre: string | null;
  categorie: string | null;
}

export type Nature = "amendement" | "article" | "partie" | "ensemble" | "procedure" | "declaration" | "censure" | "autre";

export type Genre =
  | "projet-constit"
  | "projet-org"
  | "projet"
  | "proposition-constit"
  | "proposition-org"
  | "proposition"
  | "resolution"
  | "declaration"
  | "censure"
  | "autre";

export type Issue = "adopte" | "rejete";

export interface ComptesNature {
  amendement: number;
  article: number;
  partie: number;
  ensemble: number;
  procedure: number;
  declaration: number;
  censure: number;
  autre: number;
}

export interface TexteHebdo {
  /** Clé stable : uid de dossier, ou titre normalisé pour un scrutin non rattaché. */
  cle: string;
  dossierRef: string | null;
  /** Scrutin à ouvrir quand le texte n'a pas de dossier (le vote sur l'ensemble en priorité). */
  scrutinUid: string;
  titre: string;
  genre: Genre;
  genreLabel: string;
  lecture: string | null;
  nb: number;
  comptes: ComptesNature;
  solennel: boolean;
  /** Issue du DERNIER vote sur l'ensemble de la semaine, s'il y en a eu un en scrutin public. */
  ensemble: Issue | null;
  /** Issue de la motion de censure, s'il y en a eu une. */
  censure: Issue | null;
  derniereDate: string;
  score: number;
  /** Lecture du dernier vote sur l'ensemble (« 1re lecture »…), quand il y en a un. */
  lectureEnsemble: string | null;
}

export interface ThemeHebdo {
  /** id de catégorie, ou null = « Autres textes » (thème non attribué). */
  categorie: string | null;
  textes: TexteHebdo[];
  nb: number;
}

export interface EditionHebdo {
  vendredi: string;
  debut: string;
  fin: string;
  nbScrutins: number;
  nbTextes: number;
  themes: ThemeHebdo[];
  /** Reprise après une longue interruption des scrutins publics (vacances…), sinon null. */
  reprise: Reprise | null;
}

/** Premier scrutin public de l'édition (`le`) et dernier scrutin public avant lui (`depuis`). */
export interface Reprise {
  le: string;
  depuis: string;
}

/** Écart minimal (en jours) entre deux scrutins publics pour parler de reprise : couvre les
 *  vacances d'été et de fin d'année, pas les semaines de suspension d'une semaine. */
export const ECART_REPRISE_JOURS = 14;

// --- Dates (ISO YYYY-MM-DD, arithmétique en UTC pour éviter tout décalage de fuseau) --------

const JOUR_MS = 86_400_000;
const versUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const versIso = (t: number) => new Date(t).toISOString().slice(0, 10);
const jourSemaine = (iso: string) => new Date(versUTC(iso)).getUTCDay(); // 0 = dimanche, 5 = vendredi

export function ajouterJours(iso: string, n: number): string {
  return versIso(versUTC(iso) + n * JOUR_MS);
}

/** Vendredi de la dernière édition PARUE à la date `jour` (le jour même si c'est un vendredi). */
export function vendrediParu(jour: string): string {
  return ajouterJours(jour, -((jourSemaine(jour) - 5 + 7) % 7));
}

/** Vendredi de l'édition qui contient un scrutin daté `date` (premier vendredi strictement après). */
export function editionDuScrutin(date: string): string {
  return ajouterJours(date, (5 - jourSemaine(date) + 7) % 7 || 7);
}

/** Fenêtre couverte par l'édition du vendredi `v` : du vendredi précédent au jeudi inclus. */
export function fenetre(v: string): { debut: string; fin: string } {
  return { debut: ajouterJours(v, -7), fin: ajouterJours(v, -1) };
}

/** Date du jour à Paris (le rythme de parution suit l'heure française, pas celle de l'appareil). */
export function aujourdhuiParis(maintenant: Date = new Date()): string {
  try {
    const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(maintenant);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  } catch {
    /* Intl sans fuseaux : repli sur l'heure locale */
  }
  const p = (n: number) => String(n).padStart(2, "0");
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

/** Vendredis ayant au moins un scrutin, du plus ancien au plus récent. */
export function editionsAvecContenu(scrutins: ScrutinSrc[]): string[] {
  const set = new Set<string>();
  for (const s of scrutins) if (s.date) set.add(editionDuScrutin(s.date));
  return [...set].sort();
}

// --- Libellés de date -----------------------------------------------------------------------

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function jourMois(iso: string): string {
  const j = +iso.slice(8, 10);
  return `${j === 1 ? "1er" : j} ${MOIS[+iso.slice(5, 7) - 1]}`;
}

/** « Du 2 au 8 octobre », « Du 26 septembre au 2 octobre », année ajoutée hors année courante. */
export function libelleFenetre(v: string, anneeCourante: string): string {
  const { debut, fin } = fenetre(v);
  const aD = debut.slice(0, 4);
  const aF = fin.slice(0, 4);
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  const finTxt = jourMois(fin) + (aF !== anneeCourante ? ` ${aF}` : "");
  if (aD !== aF) return `Du ${jourMois(debut)} ${aD} au ${jourMois(fin)} ${aF}`;
  if (memeMois) {
    const j = +debut.slice(8, 10);
    return `Du ${j === 1 ? "1er" : j} au ${finTxt}`;
  }
  return `Du ${jourMois(debut)} au ${finTxt}`;
}

/** « Édition du vendredi 9 octobre » (année ajoutée hors année courante). */
export function libelleParution(v: string, anneeCourante: string): string {
  return `Édition du vendredi ${jourMois(v)}${v.slice(0, 4) !== anneeCourante ? ` ${v.slice(0, 4)}` : ""}`;
}

/** Libellé court d'une date d'édition, pour un bouton (« 26 juin », « 26 juin 2025 »). */
export function libelleCourt(v: string, anneeCourante: string): string {
  return jourMois(v) + (v.slice(0, 4) !== anneeCourante ? ` ${v.slice(0, 4)}` : "");
}

// --- Lecture d'un intitulé de scrutin -------------------------------------------------------

const norm = (t: string | null | undefined) => (t ?? "").toLowerCase().replace(/[’`]/g, "'");

export function natureScrutin(s: Pick<ScrutinSrc, "titre" | "type_vote">): Nature {
  const t = norm(s.titre);
  if (norm(s.type_vote).includes("censure") || t.includes("motion de censure")) return "censure";
  if (/amendement|amenedement/.test(t)) return "amendement"; // avant tout : l'intitulé cite le texte visé
  if (/motion (de rejet|de renvoi|référendaire|d'ajournement)|suspension de séance|seconde délibération|prolongation de la séance/.test(t)) return "procedure";
  if (/^la déclaration (du gouvernement|de politique générale)/.test(t)) return "declaration";
  if (t.includes("l'ensemble")) return "ensemble";
  // Vote direct sur le texte entier (résolutions, conventions internationales).
  if (/^(la proposition de résolution|le projet de loi|la proposition de loi)/.test(t)) return "ensemble";
  if (/^la (première|deuxième|troisième|quatrième) partie/.test(t)) return "partie";
  if (/^(l'article|les articles|l'annexe)/.test(t)) return "article";
  return "autre";
}

const GENRES: [RegExp, Exclude<Genre, "censure" | "autre">][] = [
  [/projet de loi constitutionnelle/, "projet-constit"],
  [/projet de loi organique/, "projet-org"],
  [/projet de loi/, "projet"],
  [/proposition de loi constitutionnelle/, "proposition-constit"],
  [/proposition de loi organique/, "proposition-org"],
  [/proposition de loi/, "proposition"],
  [/résolution/, "resolution"],
  [/déclaration (du gouvernement|de politique générale)/, "declaration"],
];

export const GENRE_LABEL: Record<Genre, string> = {
  "projet-constit": "Projet de loi constitutionnelle",
  "projet-org": "Projet de loi organique",
  projet: "Projet de loi",
  "proposition-constit": "Proposition de loi constitutionnelle",
  "proposition-org": "Proposition de loi organique",
  proposition: "Proposition de loi",
  resolution: "Proposition de résolution",
  declaration: "Déclaration du Gouvernement",
  censure: "Motion de censure",
  autre: "Scrutin",
};

function genreDe(t: string): Genre | null {
  const n = norm(t);
  for (const [re, g] of GENRES) if (re.test(n)) return g;
  return null;
}

const LECTURES: [RegExp, string][] = [
  [/\(lecture définitive\)/, "lecture définitive"],
  [/\(nouvelle lecture\)/, "nouvelle lecture"],
  [/commission mixte paritaire/, "texte de la CMP"],
  [/\(troisième lecture\)/, "3e lecture"],
  [/\(deuxième lecture\)/, "2e lecture"],
  [/\(première lecture\)/, "1re lecture"],
];

function lectureDe(t: string): string | null {
  const n = norm(t);
  for (const [re, l] of LECTURES) if (re.test(n)) return l;
  return null;
}

function majoritaire<T>(valeurs: (T | null)[]): T | null {
  const c = new Map<T, number>();
  for (const v of valeurs) if (v !== null) c.set(v, (c.get(v) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [v, k] of c) if (k > n) { best = v; n = k; }
  return best;
}

const capitaliser = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Clé de comparaison : minuscules, sans accents ni ponctuation. */
const cleTexte = (t: string | null | undefined) =>
  norm(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const VIDES = new Set(["de", "la", "le", "les", "l", "d", "a", "et", "des", "du", "en", "pour", "au", "aux", "un", "une", "sur", "dans", "par", "visant", "tendant", "portant", "relative", "relatif", "proposition", "projet", "loi", "resolution", "europeenne"]);
// Pluriel ramené au singulier (« cancers » = « cancer ») : assez pour comparer deux intitulés.
const radical = (m: string) => (m.length > 3 && /[sx]$/.test(m) ? m.slice(0, -1) : m);
const motsUtiles = (t: string) => new Set(cleTexte(t).split(" ").filter((m) => m.length > 1 && !VIDES.has(m)).map(radical));

/**
 * Scrutin non rattaché par l'AN : on cherche son dossier par l'intitulé. Un dossier correspond si
 * au moins 85 % de ses mots utiles (3 au minimum) figurent dans l'intitulé du scrutin. Évite qu'un
 * même texte apparaisse deux fois (une fois sous son dossier, une fois sous son intitulé brut).
 */
export function rattacherDossier(titreScrutin: string, dossiers: DossierSrc[], preferes: Set<string> = new Set()): string | null {
  const mots = motsUtiles(titreScrutin);
  const exact = cleTexte(titreScrutin);
  let best: { ref: string; cov: number; n: number; pref: boolean } | null = null;
  for (const d of dossiers) {
    if (cleTexte(d.titre) === exact) return d.ref; // intitulé identique : aucun doute
    const md = motsUtiles(d.titre ?? "");
    if (md.size < 3) continue;
    let k = 0;
    for (const m of md) if (mots.has(m)) k += 1;
    const cov = k / md.size;
    if (cov < 0.85) continue;
    const cand = { ref: d.ref, cov, n: md.size, pref: preferes.has(d.ref) };
    if (!best || Number(cand.pref) > Number(best.pref) || (cand.pref === best.pref && (cand.cov > best.cov || (cand.cov === best.cov && cand.n > best.n)))) best = cand;
  }
  return best?.ref ?? null;
}

/**
 * Titre affiché : on retire le genre (déjà dit sur la ligne de méta) quand il introduit l'objet par
 * « visant à », « tendant à » ou « portant ». Aucune reformulation : seuls ces mots d'amorce partent.
 * « Proposition de loi visant à protéger les mineurs » → « Protéger les mineurs ».
 */
export function titreCourt(titre: string): string {
  const m = titre.match(/^(projet|proposition) de (loi|résolution)( organique| constitutionnelle| européenne)? (visant à |tendant à |portant )(.+)$/i);
  return m ? capitaliser(m[5].trim()) : titre;
}

/** Nom du texte quand le scrutin n'est rattaché à aucun dossier : on l'extrait de l'intitulé. */
export function titreDepuisScrutin(titre: string | null): string {
  const t = (titre ?? "").replace(/[’`]/g, "'").trim();
  const m = t.match(/(projet de loi|proposition de loi|proposition de résolution)[^()]*/i);
  const brut = m ? m[0] : t.replace(/^(l'|la |le |les )/i, "");
  return capitaliser(brut.trim().replace(/[\s.,;:]+$/, ""));
}

const issueDe = (sort: string | null): Issue | null => {
  const s = norm(sort);
  if (!s) return null;
  return s.startsWith("adopt") ? "adopte" : "rejete";
};

const plus = (a: string, b: string) => (a > b ? a : b);

// --- Construction d'une édition -------------------------------------------------------------

function construireTexte(cle: string, scrs: ScrutinSrc[], dossier: DossierSrc | undefined): TexteHebdo & { theme: string | null } {
  const comptes: ComptesNature = { amendement: 0, article: 0, partie: 0, ensemble: 0, procedure: 0, declaration: 0, censure: 0, autre: 0 };
  let solennel = false;
  let derniereDate = "";
  let ensembleS: ScrutinSrc | null = null;
  let censureS: ScrutinSrc | null = null;
  for (const s of scrs) {
    const n = natureScrutin(s);
    comptes[n] += 1;
    if (norm(s.type_vote).includes("solennel")) solennel = true;
    derniereDate = plus(derniereDate, s.date ?? "");
    if (n === "ensemble" && (!ensembleS || (s.numero ?? 0) > (ensembleS.numero ?? 0))) ensembleS = s;
    if (n === "censure" && (!censureS || (s.numero ?? 0) > (censureS.numero ?? 0))) censureS = s;
  }
  const horsCensure = scrs.filter((s) => natureScrutin(s) !== "censure");
  const genre: Genre =
    majoritaire(horsCensure.map((s) => genreDe(s.titre ?? ""))) ??
    (dossier?.titre ? genreDe(dossier.titre) : null) ??
    (comptes.censure > 0 ? "censure" : "autre");
  const lecture = majoritaire(horsCensure.map((s) => lectureDe(s.titre ?? "")));
  const titre = titreCourt(dossier?.titre?.trim() || titreDepuisScrutin((ensembleS ?? scrs[0]).titre));
  const theme = dossier?.categorie ?? majoritaire(scrs.map((s) => s.categorie ?? null));
  const ensemble = ensembleS ? issueDe(ensembleS.sort_code) : null;
  const censure = censureS ? issueDe(censureS.sort_code) : null;
  // Poids d'un texte dans la semaine : volume de scrutins publics, majoré pour les temps forts
  // objectifs (scrutin solennel, vote sur l'ensemble, motion de censure). Aucun jugement de fond.
  const score = scrs.length + (solennel ? 50 : 0) + (comptes.ensemble ? 20 : 0) + (comptes.censure ? 200 : 0);
  return {
    cle,
    dossierRef: dossier?.ref ?? null,
    scrutinUid: (ensembleS ?? censureS ?? scrs[0]).uid,
    titre,
    genre,
    genreLabel: GENRE_LABEL[genre],
    lecture,
    nb: scrs.length,
    comptes,
    solennel,
    ensemble,
    censure,
    derniereDate,
    score,
    lectureEnsemble: ensembleS ? lectureDe(ensembleS.titre ?? "") : null,
    theme,
  };
}

const versMap = (d: DossierSrc[] | Map<string, DossierSrc>) => (d instanceof Map ? d : new Map(d.map((x) => [x.ref, x])));

/**
 * Regroupe des scrutins par texte : par dossier AN, et pour un scrutin non rattaché, par le
 * dossier retrouvé d'après son intitulé (sinon par l'intitulé lui-même).
 */
function grouperParTexte(scrutins: ScrutinSrc[], parRef: Map<string, DossierSrc>): (TexteHebdo & { theme: string | null })[] {
  const liste = [...parRef.values()];
  const presents = new Set(scrutins.map((s) => s.dossier_ref).filter((r): r is string => !!r));
  const groupes = new Map<string, ScrutinSrc[]>();
  const rattaches = new Map<string, string | null>(); // intitulé dérivé → dossier retrouvé (mémo)
  for (const s of scrutins) {
    let cle = s.dossier_ref || null;
    if (!cle) {
      const derive = titreDepuisScrutin(s.titre);
      if (!rattaches.has(derive)) rattaches.set(derive, rattacherDossier(derive, liste, presents));
      cle = rattaches.get(derive) ?? `t:${cleTexte(derive)}`;
    }
    const g = groupes.get(cle);
    if (g) g.push(s);
    else groupes.set(cle, [s]);
  }
  return [...groupes.entries()].map(([cle, scrs]) => construireTexte(cle, scrs, cle.startsWith("t:") ? undefined : parRef.get(cle)));
}

export function construireEdition(vendredi: string, scrutins: ScrutinSrc[], dossiers: DossierSrc[] | Map<string, DossierSrc>): EditionHebdo {
  const { debut, fin } = fenetre(vendredi);
  const parRef = versMap(dossiers);
  const dansFenetre = scrutins.filter((s) => s.date && s.date >= debut && s.date <= fin);
  const nbScrutins = dansFenetre.length;
  const textes = grouperParTexte(dansFenetre, parRef);
  const ordreTexte = (a: TexteHebdo, b: TexteHebdo) => b.score - a.score || b.nb - a.nb || a.titre.localeCompare(b.titre, "fr");

  const parTheme = new Map<string | null, TexteHebdo[]>();
  for (const { theme, ...t } of textes) {
    const l = parTheme.get(theme);
    if (l) l.push(t);
    else parTheme.set(theme, [t]);
  }
  const themes: ThemeHebdo[] = [...parTheme.entries()].map(([categorie, l]) => ({
    categorie,
    textes: l.sort(ordreTexte),
    nb: l.reduce((n, t) => n + t.nb, 0),
  }));
  // Thèmes : somme des poids de leurs textes, puis volume. « Autres textes » toujours en dernier.
  const poids = (t: ThemeHebdo) => t.textes.reduce((n, x) => n + x.score, 0);
  themes.sort((a, b) => {
    if ((a.categorie === null) !== (b.categorie === null)) return a.categorie === null ? 1 : -1;
    return poids(b) - poids(a) || b.nb - a.nb;
  });

  return { vendredi, debut, fin, nbScrutins, nbTextes: textes.length, themes, reprise: repriseDe(dansFenetre, scrutins) };
}

/**
 * L'édition rouvre-t-elle les scrutins publics après une longue interruption ? On compare son
 * premier scrutin au dernier scrutin public qui le précède. On ne dit que ce que montrent les
 * données (pas de « session », pas de cause) : la date de reprise et celle du dernier scrutin.
 */
function repriseDe(dansFenetre: ScrutinSrc[], tous: ScrutinSrc[]): Reprise | null {
  let le = "";
  for (const s of dansFenetre) if (s.date && (!le || s.date < le)) le = s.date;
  if (!le) return null;
  let depuis = "";
  for (const s of tous) if (s.date && s.date < le && s.date > depuis) depuis = s.date;
  if (!depuis) return null; // tout premier scrutin de la législature : rien à « reprendre »
  return (versUTC(le) - versUTC(depuis)) / JOUR_MS >= ECART_REPRISE_JOURS ? { le, depuis } : null;
}

/** « Reprise le 1er octobre : aucun scrutin public depuis le 21 juillet. » */
export function libelleReprise(r: Reprise, anneeCourante: string): string {
  return `Reprise le ${libelleCourt(r.le, anneeCourante)} : aucun scrutin public depuis le ${libelleCourt(r.depuis, anneeCourante)}.`;
}

// --- Libellés de contenu --------------------------------------------------------------------

const pl = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;

export const libelleScrutins = (n: number) => pl(n, "scrutin public", "scrutins publics");

/** Ventilation factuelle : « 19 amendements · 3 articles · vote sur l'ensemble ». */
export function ventilation(c: ComptesNature): string {
  const parts: string[] = [];
  if (c.amendement) parts.push(pl(c.amendement, "amendement", "amendements"));
  if (c.article) parts.push(pl(c.article, "article", "articles"));
  if (c.partie) parts.push(c.partie > 1 ? `${c.partie} votes sur une partie` : "vote sur une partie");
  if (c.procedure) parts.push(pl(c.procedure, "vote de procédure", "votes de procédure"));
  if (c.ensemble) parts.push(c.ensemble > 1 ? `${c.ensemble} votes sur l'ensemble` : "vote sur l'ensemble");
  if (c.declaration) parts.push("vote sur la déclaration");
  if (c.censure) parts.push(c.censure > 1 ? `${c.censure} motions de censure` : "motion de censure");
  if (c.autre) parts.push(pl(c.autre, "autre vote", "autres votes"));
  return parts.join(" · ");
}

// --- Focus actualité ------------------------------------------------------------------------

/**
 * Définition d'un focus (fichier `content/focus.ts`, édité à la main). Le choix du SUJET est
 * éditorial ; le choix des TEXTES ne l'est pas : c'est le critère `motsCles`, appliqué aux
 * intitulés (dossier + texte cité dans les scrutins), et affiché tel quel sous le focus.
 * `exclure` (uids de dossier) ne sert qu'à écarter un faux positif évident, à justifier.
 */
export interface FocusDef {
  motsCles: RegExp;
  exclure?: string[];
}

/** Textes de la législature qui répondent au critère d'un focus, du plus récent au plus ancien. */
export function textesFocus(def: FocusDef, scrutins: ScrutinSrc[], dossiers: DossierSrc[] | Map<string, DossierSrc>): TexteHebdo[] {
  const parRef = versMap(dossiers);
  const exclus = new Set(def.exclure ?? []);
  const retenus = scrutins.filter((s) => {
    if (s.dossier_ref && exclus.has(s.dossier_ref)) return false;
    const intitule = `${parRef.get(s.dossier_ref ?? "")?.titre ?? ""} ${titreDepuisScrutin(s.titre)}`;
    return def.motsCles.test(intitule);
  });
  return grouperParTexte(retenus, parRef)
    .filter((t) => !(t.dossierRef && exclus.has(t.dossierRef)))
    .map(({ theme, ...t }) => t)
    .sort((a, b) => b.derniereDate.localeCompare(a.derniereDate) || b.nb - a.nb);
}

/** « 11 juin 2026 », « 1er février 2025 ». */
export function libelleDate(iso: string): string {
  return `${jourMois(iso)} ${iso.slice(0, 4)}`;
}

/** Ligne d'un texte du focus : « Proposition de loi, 11 scrutins publics, texte adopté en 1re lecture ». */
export function metaFocus(t: TexteHebdo): string {
  const parts: string[] = [];
  if (t.genre !== "autre" && !norm(t.titre).startsWith(norm(t.genreLabel))) parts.push(t.genreLabel);
  parts.push(libelleScrutins(t.nb));
  if (t.ensemble) {
    const verbe = t.ensemble === "adopte" ? "adopté" : "rejeté";
    const l = t.lectureEnsemble;
    parts.push(l === "texte de la CMP" ? `texte de la CMP ${verbe}` : `texte ${verbe}${l ? ` en ${l}` : ""}`);
  }
  const txt = parts.join(", ");
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
