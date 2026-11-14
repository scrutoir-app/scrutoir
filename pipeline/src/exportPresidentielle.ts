/**
 * Export de la rubrique Présidentielle 2027 → app/public/data/presidentielle/ (puis data.scrutoir.fr).
 *
 * Un programme n'est écrit QUE s'il est « enService » dans programmes/presidentielle.json (ou forcé
 * pour un aperçu privé, `--forcer <id>`). Sinon, seul index.json est écrit, avec `programmes: []` :
 * aucune donnée de verdict ne sort tant que la rubrique n'est pas mise en service.
 *
 * Entrées, par programme (programmes/<dossier>/, non suivi par git avant la mise en service) :
 *   mesures.json, classement.json, verdicts/*.json, lfi-2027-chiffrees-28.json (motif *-chiffrees-*.json),
 *   attendus.json (comptes attendus, contrôle bloquant), methode/a_juger.json (facultatif).
 * Sorties :
 *   index.json · <id>/programme.json · <id>/chapitre/<chapitreId>.json · <id>/chiffrage.json
 *
 * Contrôles bloquants (l'export échoue) : partition des statuts, sommes des comptes, cohérence
 * statut ↔ effets des scrutins, lignes chiffrées ↔ mesures, comptes attendus (attendus.json).
 * Aucun montant du chiffrage n'est exporté.
 *
 * Usage autonome : npm run export:presidentielle [-- --forcer <id>] [--sortie <dossier>]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Alerte, ChapitreDetail, ChapitreResume, ChiffrageDetail, Comptes, Effet, IndexPresidentielle, LigneChiffree,
  MesureLegere, PositionGroupe, Programme, ProgrammeResume, ScrutinConfronte, Statut,
} from "../../app/src/presidentielle/types";
import { comptesDe, confrontables, ordonnerProgrammes } from "../../app/src/presidentielle/logique";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DOSSIER_PROGRAMMES = path.resolve(__dirname, "../programmes");
export const CONFIG = path.join(DOSSIER_PROGRAMMES, "presidentielle.json");
const SORTIE_DEFAUT = path.resolve(__dirname, "../../app/public/data");

// ---------------------------------------------------------------------------------------------
// Configuration

export interface ConfigProgramme {
  id: string;
  dossier: string;
  enService: boolean;
  alias?: string[];
  parti: string;
  groupe: { uid: string; abrev: string; libelle: string } | null;
  publieLe: string;
  livre: { titre: string; url: string };
  chiffrage?: { titre: string; url: string; date: string } | null;
  base: { scrutins: number; du: string; au: string };
}
export interface ConfigPresidentielle {
  programmes: ConfigProgramme[];
}

export function lireConfig(fichier = CONFIG): ConfigPresidentielle {
  const c = JSON.parse(fs.readFileSync(fichier, "utf8")) as ConfigPresidentielle;
  if (!Array.isArray(c.programmes)) throw new Error(`${fichier} : « programmes » manquant`);
  const ids = new Set<string>();
  for (const p of c.programmes) {
    if (!/^[a-z0-9-]+$/.test(p.id)) throw new Error(`Programme : id invalide « ${p.id} »`);
    if (ids.has(p.id)) throw new Error(`Programme en double : ${p.id}`);
    ids.add(p.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.publieLe)) throw new Error(`${p.id} : publieLe invalide`);
    if (typeof p.enService !== "boolean") throw new Error(`${p.id} : enService doit être true ou false`);
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// Lecture des données d'analyse

interface MesureBrute {
  id: string;
  partie: string;
  chapitre: string;
  section: string | null;
  texte: string;
  url: string | null;
  mesure_cle: boolean;
  sous_mesure_de: string | null;
}
interface ClassementBrut extends MesureBrute {
  statut: "confrontable" | "hors champ";
  motif: string;
}
interface ScrutinBrut {
  uid?: string;
  numero: number;
  date: string;
  intitule: string;
  dossier?: string | null;
  sens: string;
  base?: string;
  extrait?: string;
  ecart?: string;
  note?: string;
  sort: string;
  vote_lfi?: { position: string; pour: number; contre: number; abstention: number; votants_lfi: number };
  vote_groupe?: { position: string; pour: number; contre: number; abstention: number; votants: number };
  effet: string;
  vigilance?: string[];
}
interface VerdictBrut extends MesureBrute {
  verdict: string;
  scrutins: ScrutinBrut[];
}
interface LigneBrute {
  code: string;
  type: string;
  libelle_chiffrage: string;
  confronte_avec: { mesure_programme?: string; texte?: string; libelle_chiffrage?: string };
  verdict: string;
  a_juger?: string;
  scrutins: ScrutinBrut[];
  mesures_secondaires: { id: string; verdict: string }[];
}

const FICHIERS_VERDICT: Record<string, Exclude<Statut, "h">> = {
  "coherent.json": "c",
  "tension.json": "t",
  "a-juger.json": "j",
  "pas-de-vote-representatif.json": "r",
  "pas-de-scrutin-public.json": "s",
};
const VERDICT_LIBELLE: Record<string, Exclude<Statut, "h">> = {
  "Cohérent": "c",
  "Tension": "t",
  "À juger": "j",
  "Pas de vote représentatif": "r",
  "Pas de scrutin public": "s",
};
const EFFETS: Record<string, Effet> = {
  "cohérent": "c",
  "tension": "t",
  "à juger": "j",
  "non représentatif": "r",
  "neutre": "o",
  "non exprimé": "x",
};
const POSITIONS: Record<string, PositionGroupe> = {
  "pour": "pour",
  "contre": "contre",
  "abstention": "abstention",
  "partagé (pour/abstention)": "partage",
  "partagé (contre/abstention)": "partage",
  "partagé (pour/contre)": "partage",
  "non votant": "aucun",
  "absent du scrutin": "aucun",
};

function lireJson<T>(f: string): T {
  return JSON.parse(fs.readFileSync(f, "utf8")) as T;
}

function erreur(id: string, msg: string): never {
  throw new Error(`[presidentielle:${id}] ${msg}`);
}

/** Numéro de la partie / du chapitre depuis « Partie 2 – Titre » et « Chapitre 2 : Titre ». */
function decouper(libelle: string, motif: RegExp, id: string): { n: number; titre: string } {
  const m = libelle.match(motif);
  if (!m) erreur(id, `libellé inattendu : « ${libelle} »`);
  return { n: Number(m[1]), titre: m[2].trim() };
}

const RAISON_A_JUGER = /^à juger \(arbitrage 10\) : /;

// Avertissements (non bloquants) du dernier construireProgramme : cas à relire avant la mise en service.
let AVERTISSEMENTS: string[] = [];
const avertir = (m: string) => AVERTISSEMENTS.push(m);
/** Mentions internes à la méthode, illisibles pour le public, dans un texte qui sera publié. */
const MENTION_INTERNE = /\bAnthony\b|\barbitrages? \d|cas de contrôle|\bharmonise|\blot [A-Z0-9]/i;

/** Normalise un scrutin brut. Toute valeur inconnue fait échouer l'export (rien de perdu en silence). */
function scrutin(id: string, b: ScrutinBrut, raisonForcee?: string, aJugerParNumero?: Record<string, string>): ScrutinConfronte {
  const ctx = `${id} / n° ${b.numero}`;
  const v = b.vote_lfi
    ? { position: b.vote_lfi.position, pour: b.vote_lfi.pour, contre: b.vote_lfi.contre, abstention: b.vote_lfi.abstention, votants: b.vote_lfi.votants_lfi }
    : b.vote_groupe;
  if (!v) erreur(id, `${ctx} : vote du groupe manquant`);
  const position = POSITIONS[v.position];
  if (!position) erreur(id, `${ctx} : position inconnue « ${v.position} »`);
  let effet = EFFETS[b.effet];
  if (!effet) erreur(id, `${ctx} : effet inconnu « ${b.effet} »`);
  const sens = b.sens === "même sens" ? "meme" : b.sens === "sens inverse" ? "inverse" : erreur(id, `${ctx} : sens inconnu « ${b.sens} »`);
  const sort = /^adopt/.test(b.sort) ? "adopte" : /^rejet/.test(b.sort) ? "rejete" : erreur(id, `${ctx} : sort inconnu « ${b.sort} »`);
  if (v.pour + v.contre + v.abstention !== v.votants) erreur(id, `${ctx} : décompte incohérent`);
  if ((v.votants === 0) !== (position === "aucun")) erreur(id, `${ctx} : position « ${v.position} » avec ${v.votants} votants`);
  const uid = b.uid ?? `VTANR5L17V${b.numero}`;
  if (!/^VTANR5L17V\d+$/.test(uid) || uid !== `VTANR5L17V${b.numero}`) erreur(id, `${ctx} : uid inattendu ${uid}`);

  const alertes: Alerte[] = [];
  let raisonAJuger: string | undefined;
  for (const vg of b.vigilance ?? []) {
    if (vg.startsWith("appariement sur le seul intitulé")) alertes.push("intitule-seul");
    else if (/^amendement déposé par un député du groupe .* sur lequel le groupe a voté contre/.test(vg)) alertes.push("auteur-du-groupe");
    else if (RAISON_A_JUGER.test(vg)) raisonAJuger = vg.replace(RAISON_A_JUGER, "").trim();
    // Les trois suivantes se lisent sur le scrutin lui-même (effet, votants) : rien à recopier.
    else if (/^seuls \d+ députés? du groupe (a|ont) voté : position non représentative/.test(vg)) {
      if (effet !== "r" && effet !== "o" && effet !== "c") erreur(id, `${ctx} : position non représentative avec effet ${b.effet}`);
    } else if (/^aucun député .* votant : compté comme tension/.test(vg)) {
      if (v.votants !== 0 || effet !== "t") erreur(id, `${ctx} : « aucun votant » incohérent`);
    } else if (/^abstention sur un scrutin de sens inverse, auteur : .* → neutre/.test(vg)) {
      if (effet !== "o" && effet !== "r" && effet !== "j") avertir(`${ctx} : vigilance « abstention de sens inverse → neutre » mais effet « ${b.effet} » (position ${v.position})`);
    } else erreur(id, `${ctx} : vigilance inconnue « ${vg.slice(0, 80)} »`);
  }
  // Ligne du chiffrage forcée « à juger » (arbitrage 10) : son scrutin de tension est le cas discuté.
  if (raisonForcee !== undefined && effet === "t") {
    effet = "j";
    raisonAJuger = raisonForcee;
  }
  if (!raisonAJuger && effet === "j" && aJugerParNumero?.[String(b.numero)]) raisonAJuger = aJugerParNumero[String(b.numero)];

  const s: ScrutinConfronte = {
    numero: b.numero,
    uid,
    date: b.date,
    sort,
    sens,
    effet,
    position,
    pour: v.pour,
    contre: v.contre,
    abstention: v.abstention,
    votants: v.votants,
    intitule: b.intitule.trim(),
    alertes,
  };
  if (b.dossier) s.dossier = b.dossier;
  if (b.base === "dispositif" || b.base === "intitulé" || b.base === "dossier") s.base = b.base === "intitulé" ? "intitule" : b.base;
  if (b.extrait?.trim()) s.extrait = b.extrait.trim();
  if (b.ecart?.trim()) s.ecart = b.ecart.trim();
  if (b.note?.trim()) s.note = b.note.trim();
  if (raisonAJuger) s.raisonAJuger = raisonAJuger;
  for (const k of ["ecart", "note", "raisonAJuger"] as const)
    if (s[k] && MENTION_INTERNE.test(s[k]!)) avertir(`${ctx} : mention interne dans « ${k} » : « ${s[k]!.match(MENTION_INTERNE)![0]} »`);
  return s;
}

/** Le statut d'une mesure est-il cohérent avec les effets de ses scrutins (règles 3, 6, 9, 10) ? */
function verifierStatut(id: string, statut: Statut, scrutins: ScrutinConfronte[]) {
  const n = (e: Effet) => scrutins.filter((s) => s.effet === e).length;
  const ok =
    statut === "t" ? n("t") > 0
    : statut === "c" ? n("c") > 0 && n("t") === 0 && n("j") === 0
    : statut === "j" ? n("j") > 0 && n("t") === 0
    : statut === "r" ? scrutins.length > 0 && n("c") + n("t") + n("j") === 0
    : statut === "s" ? scrutins.length === 0
    : scrutins.length === 0;
  if (!ok) erreur(id, `statut « ${statut} » incohérent avec ses scrutins (${scrutins.map((s) => s.effet).join("") || "aucun"})`);
}

interface Attendus {
  mesures: number;
  confrontables: number;
  horsChamp: number;
  cles: number;
  clesConfrontables: number;
  chiffrees: number;
  chapitres?: number;
  verdicts: Record<"all" | "cle" | "ch", Comptes>;
}

export interface Construit {
  programme: Programme;
  chapitres: ChapitreDetail[];
  chiffrage: ChiffrageDetail;
  /** Cas à relire avant la mise en service (n'empêchent pas l'export). */
  avertissements: string[];
}

/** Construit un programme à partir de son dossier d'analyse. Lève une erreur au moindre compte faux. */
export function construireProgramme(cfg: ConfigProgramme, dossier = path.join(DOSSIER_PROGRAMMES, cfg.dossier)): Construit {
  const id = cfg.id;
  AVERTISSEMENTS = [];
  const mesures = lireJson<MesureBrute[]>(path.join(dossier, "mesures.json"));
  const classement = lireJson<ClassementBrut[]>(path.join(dossier, "classement.json"));
  const classe = new Map(classement.map((c) => [c.id, c]));
  if (classe.size !== classement.length || classement.length !== mesures.length) erreur(id, "classement.json ne couvre pas exactement les mesures");

  // Statut + scrutins de chaque mesure confrontable : une et une seule fois dans verdicts/.
  const statut = new Map<string, Statut>();
  const scrutinsDe = new Map<string, ScrutinConfronte[]>();
  for (const [fichier, st] of Object.entries(FICHIERS_VERDICT)) {
    const lot = lireJson<VerdictBrut[]>(path.join(dossier, "verdicts", fichier));
    for (const v of lot) {
      if (statut.has(v.id)) erreur(id, `${v.id} figure dans deux fichiers de verdict`);
      if (VERDICT_LIBELLE[v.verdict] !== st) erreur(id, `${v.id} : verdict « ${v.verdict} » dans ${fichier}`);
      const c = classe.get(v.id);
      if (!c || c.statut !== "confrontable") erreur(id, `${v.id} : a un verdict mais n'est pas confrontable`);
      statut.set(v.id, st);
      const sc = v.scrutins.map((b) => scrutin(v.id, b));
      verifierStatut(v.id, st, sc);
      scrutinsDe.set(v.id, sc);
    }
  }

  // Chapitres (ordre du livre) et mesures légères.
  const chapitres: ChapitreResume[] = [];
  const legeres: MesureLegere[] = [];
  for (const m of mesures) {
    const c = classe.get(m.id)!;
    const chap = m.id.split("-")[0];
    if (!/^p\d+c\d+$/.test(chap)) erreur(id, `${m.id} : identifiant de mesure inattendu`);
    let ch = chapitres.find((x) => x.id === chap);
    if (!ch) {
      const pa = decouper(m.partie, /^Partie\s+(\d+)\s*[–-]\s*(.+)$/, id);
      const cp = decouper(m.chapitre, /^Chapitre\s+(\d+)\s*:\s*(.+)$/, id);
      ch = { id: chap, partie: pa.n, partieTitre: pa.titre, numero: cp.n, titre: cp.titre, url: m.url ?? null, mesures: 0, horsChamp: 0 };
      chapitres.push(ch);
    }
    ch.mesures++;
    let st: Statut;
    if (c.statut === "hors champ") {
      if (statut.has(m.id)) erreur(id, `${m.id} : hors champ mais a un verdict`);
      st = "h";
      ch.horsChamp++;
    } else {
      const s = statut.get(m.id);
      if (!s) erreur(id, `${m.id} : confrontable sans verdict`);
      st = s;
    }
    const l: MesureLegere = {
      id: m.id,
      chapitre: chap,
      section: m.section ?? null,
      texte: m.texte.trim(),
      cle: !!m.mesure_cle,
      sousMesureDe: m.sous_mesure_de ?? null,
      statut: st,
      nScrutins: scrutinsDe.get(m.id)?.length ?? 0,
    };
    if (st === "h") l.motifHorsChamp = c.motif.trim();
    legeres.push(l);
  }
  if (statut.size !== legeres.filter((m) => m.statut !== "h").length) erreur(id, "des verdicts portent sur des mesures inconnues");

  // Chiffrage : 28 lignes (aucun montant exporté).
  const fichierChiffrage = fs.readdirSync(dossier).find((f) => /-chiffrees-\d+\.json$/.test(f));
  const lignes: LigneChiffree[] = [];
  const chiffrage: ChiffrageDetail = { lignes: [] };
  if (fichierChiffrage) {
    const brut = lireJson<{ mesures: LigneBrute[] }>(path.join(dossier, fichierChiffrage));
    let aJuger: Record<string, { scrutins?: Record<string, string> }> = {};
    const fAJuger = path.join(dossier, "methode", "a_juger.json");
    if (fs.existsSync(fAJuger)) aJuger = lireJson<{ mesures: typeof aJuger }>(fAJuger).mesures ?? {};
    const parId = new Map(legeres.map((m) => [m.id, m]));
    for (const b of brut.mesures) {
      if (!/^[RD]\d{2}$/.test(b.code)) erreur(id, `ligne chiffrée : code inattendu ${b.code}`);
      const st = VERDICT_LIBELLE[b.verdict];
      if (!st) erreur(id, `${b.code} : verdict inconnu « ${b.verdict} »`);
      const type = b.type === "recette" ? "recette" : b.type === "depense" ? "depense" : erreur(id, `${b.code} : type ${b.type}`);
      const mp = b.confronte_avec.mesure_programme ?? null;
      if (mp) {
        const m = parId.get(mp);
        if (!m) erreur(id, `${b.code} : mesure ${mp} inconnue`);
        if (m.statut !== st) erreur(id, `${b.code} : statut ${st} ≠ statut de ${mp} (${m.statut})`);
        if (b.scrutins.length !== m.nScrutins) erreur(id, `${b.code} : ${b.scrutins.length} scrutins ≠ ${m.nScrutins} pour ${mp}`);
        if (m.chiffree) erreur(id, `${mp} est la mesure de deux lignes chiffrées`);
        m.chiffree = b.code;
      }
      const secondaires = b.mesures_secondaires.map((x) => {
        const m = parId.get(x.id);
        if (!m) erreur(id, `${b.code} : mesure secondaire ${x.id} inconnue`);
        return { id: x.id, statut: m.statut };
      });
      lignes.push({ code: b.code, type, libelle: b.libelle_chiffrage.trim(), statut: st, mesure: mp, secondaires });
      const raisonForcee = b.a_juger?.trim();
      const sc = mp ? [] : b.scrutins.map((s) => scrutin(b.code, s, raisonForcee, aJuger[`chiffrage-${b.code}`]?.scrutins));
      if (!mp) verifierStatut(b.code, st, sc);
      const l: ChiffrageDetail["lignes"][number] = { code: b.code, scrutins: sc };
      if (raisonForcee) l.raisonAJuger = raisonForcee;
      chiffrage.lignes.push(l);
    }
  }

  // Comptes et sommes.
  const conf = legeres.filter((m) => m.statut !== "h");
  const cles = legeres.filter((m) => m.cle);
  const verdicts = {
    all: comptesDe(conf.map((m) => m.statut)),
    cle: comptesDe(cles.map((m) => m.statut)),
    ch: comptesDe(lignes.map((l) => l.statut)),
  };
  const comptes = {
    mesures: legeres.length,
    confrontables: conf.length,
    horsChamp: legeres.length - conf.length,
    cles: cles.length,
    clesConfrontables: cles.filter((m) => m.statut !== "h").length,
    chiffrees: lignes.length,
  };
  if (confrontables(verdicts.all) !== comptes.confrontables) erreur(id, "somme des verdicts ≠ confrontables");
  if (comptes.confrontables + comptes.horsChamp !== comptes.mesures) erreur(id, "confrontables + hors champ ≠ mesures");
  if (confrontables(verdicts.cle) !== comptes.clesConfrontables) erreur(id, "somme des verdicts des mesures clés ≠ clés confrontables");
  if (confrontables(verdicts.ch) !== comptes.chiffrees) erreur(id, "somme des verdicts chiffrés ≠ lignes chiffrées");
  if (chapitres.reduce((a, c) => a + c.mesures, 0) !== comptes.mesures) erreur(id, "somme des chapitres ≠ mesures");

  // Comptes attendus (attendus.json, à côté des données) : contrôle bloquant.
  const fAttendus = path.join(dossier, "attendus.json");
  if (!fs.existsSync(fAttendus)) erreur(id, `attendus.json manquant dans ${dossier} : comptes non vérifiables`);
  const att = lireJson<Attendus>(fAttendus);
  const ecarts: string[] = [];
  for (const k of ["mesures", "confrontables", "horsChamp", "cles", "clesConfrontables", "chiffrees"] as const)
    if (comptes[k] !== att[k]) ecarts.push(`${k} ${comptes[k]} au lieu de ${att[k]}`);
  if (att.chapitres != null && chapitres.length !== att.chapitres) ecarts.push(`chapitres ${chapitres.length} au lieu de ${att.chapitres}`);
  for (const p of ["all", "cle", "ch"] as const)
    for (const k of ["c", "t", "s", "j", "r"] as const)
      if (verdicts[p][k] !== att.verdicts[p][k]) ecarts.push(`${p}.${k} ${verdicts[p][k]} au lieu de ${att.verdicts[p][k]}`);
  if (ecarts.length) erreur(id, `comptes faux : ${ecarts.join(", ")}`);

  const resume: ProgrammeResume = {
    id,
    alias: cfg.alias ?? [],
    parti: cfg.parti,
    groupe: cfg.groupe,
    publieLe: cfg.publieLe,
    mesures: comptes.mesures,
    chiffrees: comptes.chiffrees,
    base: cfg.base,
  };
  const programme: Programme = {
    ...resume,
    livre: cfg.livre,
    chiffrage: cfg.chiffrage ?? null,
    comptes,
    verdicts,
    chapitres,
    listeMesures: legeres,
    listeChiffrees: lignes,
  };
  const details: ChapitreDetail[] = chapitres.map((c) => ({
    id: c.id,
    mesures: legeres
      .filter((m) => m.chapitre === c.id && m.statut !== "h")
      .map((m) => ({ id: m.id, scrutins: scrutinsDe.get(m.id) ?? [] })),
  }));
  return { programme, chapitres: details, chiffrage, avertissements: [...new Set(AVERTISSEMENTS)] };
}

/** Garde-fou de neutralité : aucun montant ni pourcentage calculé dans ce qu'on publie. */
function verifierSansMontant(id: string, c: Construit) {
  // Clés de montant du fichier de chiffrage : aucune ne doit passer (les textes, eux, restent exacts).
  const json = JSON.stringify([c.programme, c.chiffrage]);
  if (/"(montant[^"]*|total_recettes[^"]*|total_depenses[^"]*|montant_md)":/i.test(json)) erreur(id, "un montant du chiffrage s'est glissé dans l'export");
}

// ---------------------------------------------------------------------------------------------
// Écriture

export interface ResultatExport {
  enService: string[];
  fichiers: string[];
  ignores: string[];
}

export function exporterPresidentielle({
  sortie = SORTIE_DEFAUT,
  config = CONFIG,
  dossierProgrammes = DOSSIER_PROGRAMMES,
  forcer = [],
  log = console.log,
}: { sortie?: string; config?: string; dossierProgrammes?: string; forcer?: string[]; log?: (m: string) => void } = {}): ResultatExport {
  const cfg = lireConfig(config);
  for (const f of forcer) if (!cfg.programmes.some((p) => p.id === f)) throw new Error(`[presidentielle] --forcer : programme inconnu « ${f} »`);
  const racine = path.join(sortie, "presidentielle");
  // On repart de zéro : un aperçu précédent (programme forcé) ne doit jamais rester sur le disque.
  fs.rmSync(racine, { recursive: true, force: true });
  fs.mkdirSync(racine, { recursive: true });
  const fichiers: string[] = [];
  const ecrire = (rel: string, data: unknown) => {
    const p = path.join(racine, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(data));
    fichiers.push(rel);
  };

  const publies: ProgrammeResume[] = [];
  const ignores: string[] = [];
  for (const p of cfg.programmes) {
    const actif = p.enService || forcer.includes(p.id);
    const dossier = path.join(dossierProgrammes, p.dossier);
    if (!actif) {
      // Programme dormant : rien n'est écrit. On le vérifie quand même s'il est là (avertissement).
      if (fs.existsSync(path.join(dossier, "mesures.json"))) {
        try {
          const c = construireProgramme(p, dossier);
          log(`[presidentielle] ${p.id} : hors service (données vérifiées, rien n'est publié${c.avertissements.length ? `, ${c.avertissements.length} cas à relire` : ""}).`);
        } catch (e) {
          log(`[presidentielle] ⚠️ ${p.id} hors service, données à revoir : ${(e as Error).message}`);
        }
      } else log(`[presidentielle] ${p.id} : hors service, données absentes (normal en CI).`);
      ignores.push(p.id);
      continue;
    }
    if (!fs.existsSync(path.join(dossier, "mesures.json"))) throw new Error(`[presidentielle] ${p.id} est en service mais ${dossier} est introuvable`);
    const c = construireProgramme(p, dossier);
    verifierSansMontant(p.id, c);
    ecrire(`${p.id}/programme.json`, c.programme);
    for (const ch of c.chapitres) ecrire(`${p.id}/chapitre/${ch.id}.json`, ch);
    ecrire(`${p.id}/chiffrage.json`, c.chiffrage);
    publies.push({
      id: c.programme.id, alias: c.programme.alias, parti: c.programme.parti, groupe: c.programme.groupe,
      publieLe: c.programme.publieLe, mesures: c.programme.mesures, chiffrees: c.programme.chiffrees, base: c.programme.base,
    });
    log(`[presidentielle] ${p.id} : EN SERVICE${p.enService ? "" : " (forcé, aperçu)"} — ${c.programme.mesures} mesures, ${c.chapitres.length} chapitres.`);
    if (c.avertissements.length) log(`[presidentielle] ${p.id} : ${c.avertissements.length} cas à relire :\n  - ${c.avertissements.join("\n  - ")}`);
  }
  const index: IndexPresidentielle = { generatedAt: new Date().toISOString(), programmes: ordonnerProgrammes(publies) };
  ecrire("index.json", index);
  log(`[presidentielle] ${fichiers.length} fichier(s) écrit(s) sous data/presidentielle/ (${publies.length} programme(s) en service).`);
  return { enService: publies.map((p) => p.id), fichiers, ignores };
}

// CLI : npm run export:presidentielle [-- --forcer <id>[,<id>]] [--sortie <dossier>]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (k: string) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const forcer = (val("--forcer") ?? process.env.PRESIDENTIELLE_FORCER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    exporterPresidentielle({ sortie: val("--sortie") ? path.resolve(val("--sortie")!) : undefined, forcer });
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    process.exit(1);
  }
}
