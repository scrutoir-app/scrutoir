/**
 * Lecture d'Analytics Engine (SQL API) → `Donnees` du tableau de bord.
 *
 * Fenêtres :
 *  - Chiffres clés, entonnoir, provenance : depuis `debutCompte` = max(début de période, première
 *    visite mesurée). Avant le déploiement de la mesure des visites et des partages (v1.43.0),
 *    rien n'était compté, et le trafic local se mêlait aux visiteurs : les taux ne mélangent
 *    jamais deux bases.
 *  - Période précédente (écarts) : seulement si elle commence après la première visite mesurée
 *    et reste dans la rétention d'Analytics Engine (trois mois) ; sinon « n/d ».
 *  - Graphique et classements : toute la période.
 *
 * Résilient : une requête en erreur rend [] (la page s'affiche quand même, avec des zéros).
 */

import { ISSUES_REUSSIES, QUOI_SPECTRE, SOURCES_INSTAGRAM } from "../../app/src/mesureListes";
import { joursPeriode, type Classement, type Compte, type Donnees } from "./tableau";

export interface EnvSql {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  DATASET: string;
}

type Rangee = Record<string, unknown>;

const JOUR = 86_400_000;
/** Analytics Engine : « Data written to Workers Analytics Engine is stored for three months. » */
export const RETENTION_JOURS = 90;
/** Types comptés dans les chiffres clés et l'entonnoir. */
const TYPES_COMPTES = ["arrivee", "share", "test_start", "test_done"];
/** Installer avant le test (v1.44.0) : contexte d'arrivée et gestes, lus par (t, e, x) comme les comptes. */
const TYPES_INSTALL = [
  "contexte", "installer_clic", "installer_ok", "ouvrir_navigateur", "transfert_copie", "transfert_colle", "test_sans_installer",
];
/** Types montrés ailleurs (chiffres clés ou onglets) : tout autre type va dans « Autres ». */
const COUVERTS = new Set([
  ...TYPES_COMPTES,
  ...TYPES_INSTALL,
  "scrutin", "depute", "parti", "theme", "search", "search_empty", "confront", "screen",
  "follow", "unfollow", "follow_parti", "unfollow_parti",
]);
const DONNEES_PUBLIQUES = "https://data.scrutoir.fr/data";

async function q(env: EnvSql, sql: string): Promise<Rangee[]> {
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: sql,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Rangee[] };
    return json.data || [];
  } catch {
    return [];
  }
}

async function fetchJson(u: string): Promise<any> {
  try {
    const r = await fetch(u, { cf: { cacheTtl: 3600 } } as RequestInit);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Type d'événement borné avant interpolation SQL (les types légitimes sont en [a-z_]). */
const typeSur = (t: string) => /^[a-z_]{1,32}$/.test(t);

/** Classement d'un type par entité (blob2) ou par extra (blob3). */
export const topSql = (ds: string, type: string, jours: number, limite = 6, blob: "blob2" | "blob3" = "blob2") =>
  `SELECT ${blob} AS k, sum(_sample_interval) AS n FROM ${ds}
   WHERE blob1 = '${type}' AND timestamp > NOW() - INTERVAL '${jours}' DAY
   GROUP BY k ORDER BY n DESC LIMIT ${limite}`;

const listeSql = (types: string[]) => types.map((t) => `'${t}'`).join(",");

const n = (r: Rangee) => Number(r.n) || 0;
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function compteVide(): Compte {
  return { visites: 0, visitesInstagram: 0, visitesPartage: 0, visitesPartageTest: 0, testsCommences: 0, testsTermines: 0, partagesReussis: 0, partagesSpectre: 0 };
}

/** Rangées (t, e, x, n) → compteurs. */
export function compter(rangees: Rangee[]): Compte {
  const c = compteVide();
  const insta = new Set<string>([...SOURCES_INSTAGRAM, "instagram"]);
  for (const r of rangees) {
    const t = s(r.t), e = s(r.e), x = s(r.x), v = n(r);
    if (t === "arrivee") {
      c.visites += v;
      if (insta.has(x)) c.visitesInstagram += v;
      if (x === "partage") {
        c.visitesPartage += v;
        if (e === "test") c.visitesPartageTest += v;
      }
    } else if (t === "test_start") c.testsCommences += v;
    else if (t === "test_done") c.testsTermines += v;
    else if (t === "share" && (ISSUES_REUSSIES as readonly string[]).includes(x)) {
      c.partagesReussis += v;
      if ((QUOI_SPECTRE as readonly string[]).includes(e)) c.partagesSpectre += v;
    }
  }
  return c;
}

const LIB_QUOI: Record<string, string> = {
  spectre_story: "Spectre en story",
  test_lien: "Lien du résultat",
  scrutin: "Scrutin",
  depute: "Député",
  parti: "Groupe",
  mesure: "Présidentielle · mesure",
  autre: "Hors liste",
};
const LIB_ENTREE: Record<string, string> = {
  accueil: "Accueil",
  test: "Résultat partagé",
  scrutin: "Fiche scrutin",
  depute: "Fiche député",
  parti: "Fiche groupe",
  presidentielle: "Présidentielle",
  autre: "Autre lien profond",
};
const LIB_CONTEXTE: Record<string, string> = {
  installee: "Appli installée",
  "integre-ios": "Appli intégrée · iPhone",
  "integre-android": "Appli intégrée · Android",
  ios: "iPhone · navigateur",
  "android-installable": "Android · installable",
  android: "Android · sans invite",
  ordinateur: "Ordinateur",
  autre: "Hors liste",
};
const pctTexte = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "n/d");

/**
 * Onglets « Contextes » et « Installation » (v1.44.0), depuis les rangées (t, e, x) de la période.
 * Contextes : visites par contexte d'arrivée, et tests terminés dans ce contexte (`test_done`
 * porte le contexte en extra depuis la v1.44.0), pour comparer le taux avant et après.
 */
export function classementsInstall(courant: Rangee[]): Classement[] {
  const visites = new Map<string, number>();
  const tests = new Map<string, number>();
  const g = { sortie: 0, sansInstaller: 0, clic: 0, ok: 0, copie: 0, copieMain: 0, colle: 0, colleRien: 0, colleRefus: 0 };
  for (const r of courant) {
    const t = s(r.t), e = s(r.e), x = s(r.x), v = n(r);
    if (t === "contexte") visites.set(e, (visites.get(e) ?? 0) + v);
    else if (t === "test_done" && x) tests.set(x, (tests.get(x) ?? 0) + v);
    else if (t === "ouvrir_navigateur") g.sortie += v;
    else if (t === "test_sans_installer") g.sansInstaller += v;
    else if (t === "installer_clic") g.clic += v;
    else if (t === "installer_ok") g.ok += v;
    else if (t === "transfert_copie") x === "copied" ? (g.copie += v) : (g.copieMain += v);
    else if (t === "transfert_colle") {
      if (x === "transfert" || x === "test") g.colle += v;
      else if (x === "refuse") g.colleRefus += v;
      else g.colleRien += v;
    }
  }
  const contextes = [...visites.entries()]
    .map(([k, v]) => {
      const l = LIB_CONTEXTE[k] ?? k;
      const tt = tests.get(k) ?? 0;
      return { libelle: l, n: v, detail: `${l} : ${v} visite${v > 1 ? "s" : ""} · ${tt} test${tt > 1 ? "s" : ""} terminé${tt > 1 ? "s" : ""} (${pctTexte(tt, v)})` };
    })
    .sort((a, b) => b.n - a.n);
  const gestes = [
    { libelle: "Sorties vers le navigateur", n: g.sortie, detail: `« Ouvrir dans Safari / Chrome » depuis Instagram & co : ${g.sortie}` },
    { libelle: "Tests sans installer", n: g.sansInstaller, detail: `Test lancé depuis l'écran d'arrivée sans installer : ${g.sansInstaller}` },
    { libelle: "Clics « Installer »", n: g.clic, detail: `Invite Android ou guide iPhone ouverts : ${g.clic}` },
    { libelle: "Installations acceptées", n: g.ok, detail: `Invite Android acceptée : ${g.ok}` },
    { libelle: "Réponses copiées", n: g.copie, detail: `« Copier et installer » : ${g.copie} copiées · ${g.copieMain} à copier à la main` },
    { libelle: "Réponses collées dans l'app", n: g.colle, detail: `Collées : ${g.colle} · rien de Scrutoir : ${g.colleRien} · lecture refusée : ${g.colleRefus}` },
  ].filter((l) => l.n > 0);
  return [
    { id: "contextes", onglet: "Contextes", titre: "Contexte d'arrivée, tests terminés", lignes: contextes.slice(0, 7) },
    { id: "installation", onglet: "Installation", titre: "Installer avant le test", lignes: gestes },
  ];
}

const LIB_ECRAN: Record<string, string> = {
  search: "Accueil",
  themes: "Scrutins",
  partis: "Partis",
  suivis: "Suivis",
  apropos: "Infos",
  parametres: "Paramètres",
  testIntro: "Test · intro",
  test: "Test",
  testResultat: "Test · résultat",
  monDepute: "Trouver ton député",
  confrontation: "Duel",
  accords: "Tes accords",
};

export interface Noms {
  depute: Map<string, string>;
  scrutin: Map<string, string>;
  theme: Map<string, string>;
  parti: Map<string, string>;
}

export interface Brut {
  jours: number;
  maintenant: number;
  debutMesure: number | null;
  debutCompte: number;
  precedentComparable: boolean;
  raisonND: string;
  courant: Rangee[];
  precedent: Rangee[];
  activite: Rangee[];
  parType: Rangee[];
  appareils: Rangee[];
  tops: Record<string, Rangee[]>;
}

/** Assemblage pur (testé) : rangées SQL + noms → données du tableau de bord. */
export function assembler(b: Brut, noms: Noms): Donnees {
  const provenance: Record<string, number> = {};
  const parQuoi = new Map<string, { ok: number; ferme: number; echec: number }>();
  const entrees = new Map<string, number>();
  for (const r of b.courant) {
    const t = s(r.t), e = s(r.e), x = s(r.x), v = n(r);
    if (t === "arrivee") {
      provenance[x] = (provenance[x] ?? 0) + v;
      entrees.set(e, (entrees.get(e) ?? 0) + v);
    } else if (t === "share") {
      const q = parQuoi.get(e) ?? { ok: 0, ferme: 0, echec: 0 };
      if ((ISSUES_REUSSIES as readonly string[]).includes(x)) q.ok += v;
      else if (x === "cancelled") q.ferme += v;
      else q.echec += v;
      parQuoi.set(e, q);
    }
  }

  const jours = joursPeriode(b.maintenant, b.jours);
  const parJour = new Map(jours.map((j) => [j, { jour: j, visites: 0, tests: 0 }]));
  for (const r of b.activite) {
    const p = parJour.get(s(r.d).slice(0, 10));
    if (!p) continue;
    if (s(r.t) === "arrivee") p.visites += n(r);
    else if (s(r.t) === "test_done") p.tests += n(r);
  }

  const appareils: Record<string, number> = {};
  for (const r of b.appareils) appareils[s(r.k)] = n(r);

  const top = (type: string) => b.tops[type] ?? [];
  const lignes = (type: string, libelle: (k: string) => string) =>
    top(type).map((r) => {
      const k = s(r.k);
      const l = k ? libelle(k) : "(non précisé)";
      return { libelle: l, n: n(r), detail: `${l} : ${n(r).toLocaleString("fr-FR")}` };
    });
  const net = (plus: string, moins: string, libelle: (k: string) => string) => {
    const m = new Map<string, number>();
    for (const r of top(plus)) m.set(s(r.k), (m.get(s(r.k)) ?? 0) + n(r));
    for (const r of top(moins)) m.set(s(r.k), (m.get(s(r.k)) ?? 0) - n(r));
    return [...m.entries()].filter(([k, v]) => k && v > 0).map(([k, v]) => ({ libelle: libelle(k), n: v }));
  };
  const duel = (k: string) => {
    const [a, c] = k.split("|");
    return `${noms.depute.get(a) ?? a} × ${noms.depute.get(c) ?? c}`;
  };
  const tri = <T extends { n: number }>(a: T[]) => a.sort((x, y) => y.n - x.n).slice(0, 6);

  const classements: Classement[] = [
    { id: "scrutins", onglet: "Scrutins", titre: "Scrutins les plus consultés", lignes: lignes("scrutin", (k) => noms.scrutin.get(k) ?? k) },
    { id: "deputes", onglet: "Députés", titre: "Députés les plus consultés", lignes: lignes("depute", (k) => noms.depute.get(k) ?? k) },
    { id: "partis", onglet: "Partis", titre: "Groupes les plus consultés", lignes: lignes("parti", (k) => noms.parti.get(k) ?? k) },
    { id: "themes", onglet: "Thèmes", titre: "Thèmes les plus explorés", lignes: lignes("theme", (k) => noms.theme.get(k) ?? k) },
    { id: "recherches", onglet: "Recherches", titre: "Recherches les plus fréquentes", lignes: lignes("search", (k) => k) },
    { id: "vides", onglet: "Sans résultat", titre: "Recherches sans résultat", lignes: lignes("search_empty", (k) => k) },
    { id: "duels", onglet: "Duels", titre: "Duels les plus regardés", lignes: lignes("confront", duel) },
    { id: "ecrans", onglet: "Écrans", titre: "Écrans les plus vus", lignes: lignes("screen", (k) => LIB_ECRAN[k] ?? k) },
    {
      id: "partages", onglet: "Partages", titre: "Partages réussis, par contenu",
      lignes: tri([...parQuoi.entries()].map(([k, v]) => ({
        libelle: LIB_QUOI[k] ?? k, n: v.ok,
        detail: `${LIB_QUOI[k] ?? k} : ${v.ok} réussi${v.ok > 1 ? "s" : ""} · ${v.ferme} fermé${v.ferme > 1 ? "s" : ""} sans partager · ${v.echec} impossible${v.echec > 1 ? "s" : ""}`,
      }))),
    },
    { id: "entrees", onglet: "Entrées", titre: "Écran d'arrivée des visites", lignes: tri([...entrees.entries()].map(([k, v]) => ({ libelle: LIB_ENTREE[k] ?? k, n: v }))) },
    {
      id: "suivis", onglet: "Suivis", titre: "Élus et groupes les plus suivis (solde)",
      lignes: tri([...net("follow", "unfollow", (k) => noms.depute.get(k) ?? k), ...net("follow_parti", "unfollow_parti", (k) => noms.parti.get(k) ?? k)]),
    },
    ...classementsInstall(b.courant),
  ];

  const autres = b.parType
    .map((r) => ({ type: s(r.k), n: n(r) }))
    .filter((a) => a.type && !COUVERTS.has(a.type))
    .sort((x, y) => y.n - x.n);

  return {
    jours: b.jours,
    maintenant: b.maintenant,
    debutMesure: b.debutMesure,
    debutCompte: b.debutCompte,
    courant: compter(b.courant),
    precedent: b.precedentComparable ? compter(b.precedent) : null,
    raisonND: b.raisonND,
    activite: [...parJour.values()],
    provenance,
    appareils,
    totalEvenements: b.parType.reduce((t, r) => t + n(r), 0),
    classements,
    autres,
  };
}

/** Fenêtres de calcul (pur, testé) : début des comptes, comparabilité de la période précédente. */
export function fenetres(maintenant: number, jours: number, debutMesure: number | null) {
  const debutPeriode = maintenant - jours * JOUR;
  const debutCompte = debutMesure !== null ? Math.max(debutPeriode, debutMesure) : debutPeriode;
  const avantMesure = debutMesure === null || maintenant - 2 * jours * JOUR < debutMesure;
  const horsRetention = 2 * jours > RETENTION_JOURS;
  const raisonND =
    debutMesure === null
      ? "aucune visite mesurée pour l'instant"
      : avantMesure
        ? `la période précédente commence avant le début de la mesure (${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }).format(new Date(debutMesure))})`
        : horsRetention
          ? "la période précédente sort des trois mois conservés par Analytics Engine"
          : "";
  return { debutCompte, precedentComparable: !avantMesure && !horsRetention, raisonND };
}

export async function chargerNoms(): Promise<Noms> {
  const [deps, scrs, cats, prts] = await Promise.all([
    fetchJson(`${DONNEES_PUBLIQUES}/deputes.json`),
    fetchJson(`${DONNEES_PUBLIQUES}/scrutins.json`),
    fetchJson(`${DONNEES_PUBLIQUES}/categories.json`),
    fetchJson(`${DONNEES_PUBLIQUES}/partis.json`),
  ]);
  return {
    depute: new Map((deps || []).map((d: any) => [d.uid, d.nom_complet])),
    scrutin: new Map((scrs || []).map((x: any) => [x.uid, x.titre])),
    theme: new Map((cats || []).map((c: any) => [c.id, c.libelle])),
    parti: new Map((prts || []).map((p: any) => [p.uid, p.abrev || p.libelle])),
  };
}

/** Collecte complète pour une période de `jours` jours. */
export async function collecter(env: EnvSql, jours: number, maintenant = Date.now()): Promise<Donnees> {
  const ds = env.DATASET;
  const [premiere, noms] = await Promise.all([
    q(env, `SELECT toUnixTimestamp(min(timestamp)) AS t0, sum(_sample_interval) AS n FROM ${ds} WHERE blob1 = 'arrivee'`),
    chargerNoms(),
  ]);
  const t0 = Number(premiere[0]?.t0) * 1000;
  const debutMesure = n(premiere[0] ?? {}) > 0 && t0 > 0 ? t0 : null;
  const f = fenetres(maintenant, jours, debutMesure);
  const secCompte = Math.max(1, Math.ceil((maintenant - f.debutCompte) / 1000));
  const comptes = listeSql(TYPES_COMPTES);
  const comptesEtInstall = listeSql([...TYPES_COMPTES, ...TYPES_INSTALL]);

  const tousTypes = ["scrutin", "depute", "parti", "theme", "search", "search_empty", "confront", "screen"];
  const suivis = ["follow", "unfollow", "follow_parti", "unfollow_parti"];
  const [courant, precedent, activite, parType, appareils, ...tops] = await Promise.all([
    q(env, `SELECT blob1 AS t, blob2 AS e, blob3 AS x, sum(_sample_interval) AS n FROM ${ds}
      WHERE timestamp > NOW() - INTERVAL '${secCompte}' SECOND AND blob1 IN (${comptesEtInstall}) GROUP BY t, e, x`),
    f.precedentComparable
      ? q(env, `SELECT blob1 AS t, blob2 AS e, blob3 AS x, sum(_sample_interval) AS n FROM ${ds}
          WHERE timestamp > NOW() - INTERVAL '${2 * jours}' DAY AND timestamp <= NOW() - INTERVAL '${jours}' DAY
          AND blob1 IN (${comptes}) GROUP BY t, e, x`)
      : Promise.resolve([]),
    q(env, `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS d, blob1 AS t, sum(_sample_interval) AS n FROM ${ds}
      WHERE timestamp > NOW() - INTERVAL '${jours}' DAY AND blob1 IN ('arrivee','test_done') GROUP BY d, t ORDER BY d`),
    q(env, `SELECT blob1 AS k, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${jours}' DAY GROUP BY k ORDER BY n DESC`),
    q(env, `SELECT blob4 AS k, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${jours}' DAY AND blob4 != '' GROUP BY k`),
    ...tousTypes.map((t) => q(env, topSql(ds, t, jours))),
    ...suivis.map((t) => q(env, topSql(ds, t, jours, 60))),
  ]);
  const nomsTops = [...tousTypes, ...suivis];
  const parTypeSur = parType.filter((r) => typeSur(s(r.k)));
  return assembler(
    {
      jours,
      maintenant,
      debutMesure,
      ...f,
      courant,
      precedent,
      activite,
      parType: parTypeSur,
      appareils,
      tops: Object.fromEntries(nomsTops.map((t, i) => [t, tops[i]])),
    },
    noms,
  );
}
