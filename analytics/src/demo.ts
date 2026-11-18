/**
 * Aperçu LOCAL du tableau de bord avec des données FICTIVES : `npx wrangler dev src/demo.ts`
 * (mot de passe : DASH_KEY de `analytics/.dev.vars`, gitignoré). Jamais déployé : le Worker de
 * production a pour entrée index.ts.
 *
 * Les rangées fictives passent par le vrai assemblage (`fenetres`, `assembler`) : ce qui
 * s'affiche ici est ce que la production afficherait avec ces chiffres. La date simulée est le
 * 3 décembre 2026, deux semaines après la mise en service de la mesure (19 novembre). Noms
 * d'élus, de groupes et de scrutins inventés ; la page porte « Données de démonstration ».
 */

import { assembler, fenetres, type Brut, type Noms } from "./donnees";
import { servir, type EnvServeur } from "./serveur";
import { JALONS } from "./index";
import type { Donnees } from "./tableau";

const JOUR = 86_400_000;
const MAINTENANT = Date.parse("2026-12-03T14:42:00Z");
const DEBUT_MESURE = Date.parse("2026-11-19T10:05:00Z");

// Générateur pseudo-aléatoire déterministe (mêmes chiffres à chaque chargement).
function alea(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOURCES: [string, number][] = [
  ["partage", 0.03], ["insta_bio", 0.13], ["insta_story", 0.055], ["insta_post", 0.025], ["instagram", 0.035],
  ["google", 0.17], ["bing", 0.015], ["pages_seo", 0.11], ["facebook", 0.012], ["threads", 0.006], ["x", 0.01],
  ["linkedin", 0.008], ["pwa", 0.07], ["direct", 0.295], ["autre_site", 0.022], ["autre_lien", 0.007],
];
const ENTREES_HORS_PARTAGE: [string, number][] = [["accueil", 0.8], ["depute", 0.09], ["scrutin", 0.07], ["parti", 0.02], ["autre", 0.02]];
const ENTREES_PARTAGE: [string, number][] = [["test", 0.5], ["scrutin", 0.26], ["depute", 0.16], ["parti", 0.08]];
const PARTAGES: [string, number][] = [["spectre_story", 0.5], ["test_lien", 0.22], ["scrutin", 0.16], ["depute", 0.08], ["parti", 0.04]];
const ISSUES: [string, number][] = [["shared", 0.62], ["copied", 0.08], ["downloaded", 0.06], ["cancelled", 0.21], ["manual", 0.03]];

interface Jour {
  debut: number;
  visites: number;
  testsCommences: number;
  testsTermines: number;
}

function jours(): Jour[] {
  const r = alea(42);
  const out: Jour[] = [];
  for (let i = 89; i >= 0; i--) {
    const debut = Date.parse(new Date(MAINTENANT - i * JOUR).toISOString().slice(0, 10) + "T00:00:00Z");
    const semaine = [0.82, 1, 1.04, 1.02, 0.98, 0.9, 0.78][new Date(debut).getUTCDay()];
    const croissance = 1 + (89 - i) / 140;
    const histoire = debut >= Date.parse("2026-11-09T00:00:00Z") ? 1.18 : 1; // effet du partage en story
    const trafic = 210 * semaine * croissance * histoire * (0.85 + r() * 0.3);
    const commences = Math.round(trafic * 0.24);
    out.push({
      debut,
      visites: debut + JOUR > DEBUT_MESURE ? Math.round(trafic * (debut < DEBUT_MESURE ? 0.42 : 1)) : 0,
      testsCommences: commences,
      testsTermines: Math.round(commences * (0.66 + r() * 0.08)),
    });
  }
  return out;
}

const repartir = (total: number, parts: [string, number][]) => parts.map(([k, p]) => [k, Math.round(total * p)] as const);

/** Rangées (t, e, x, n) d'une fenêtre [de, a[. */
function rangees(js: Jour[], de: number, a: number) {
  const dans = js.filter((j) => j.debut + JOUR > de && j.debut < a);
  const visites = dans.reduce((s, j) => s + j.visites, 0);
  const commences = dans.reduce((s, j) => s + j.testsCommences, 0);
  const termines = dans.reduce((s, j) => s + j.testsTermines, 0);
  const out: Record<string, unknown>[] = [
    { t: "test_start", e: "complet", x: "", n: commences },
    { t: "test_done", e: "complet", x: "", n: termines },
  ];
  for (const [source, n] of repartir(visites, SOURCES)) {
    for (const [entree, m] of repartir(n, source === "partage" ? ENTREES_PARTAGE : ENTREES_HORS_PARTAGE)) {
      if (m) out.push({ t: "arrivee", e: entree, x: source, n: m });
    }
  }
  const partages = Math.round(termines * 0.2);
  for (const [quoi, n] of repartir(partages, PARTAGES)) {
    for (const [issue, m] of repartir(n, ISSUES)) if (m) out.push({ t: "share", e: quoi, x: issue, n: m });
  }
  return out;
}

const top = (paires: [string, number][], f = 1) => paires.map(([k, n]) => ({ k, n: Math.round(n * f) }));

function donneesDemo(nbJours: number): Donnees {
  const js = jours();
  const f = fenetres(MAINTENANT, nbJours, DEBUT_MESURE);
  const periode = js.slice(-nbJours);
  const echelle = nbJours / 30;
  const activite = periode.flatMap((j) => [
    { d: `${new Date(j.debut).toISOString().slice(0, 10)} 00:00:00`, t: "arrivee", n: j.visites },
    { d: `${new Date(j.debut).toISOString().slice(0, 10)} 00:00:00`, t: "test_done", n: j.testsTermines },
  ]);
  const brut: Brut = {
    jours: nbJours,
    maintenant: MAINTENANT,
    debutMesure: DEBUT_MESURE,
    ...f,
    courant: rangees(js, f.debutCompte, MAINTENANT),
    precedent: f.precedentComparable ? rangees(js, MAINTENANT - 2 * nbJours * JOUR, MAINTENANT - nbJours * JOUR) : [],
    activite,
    parType: top([
      ["screen", 21400], ["depute", 6900], ["scrutin", 5200], ["arrivee", 4800], ["test_start", 1900], ["test_done", 1300],
      ["parti", 1450], ["theme", 980], ["search", 860], ["parcours_open", 610], ["share", 290], ["confront", 270],
      ["follow", 230], ["parcours_close", 205], ["shuffle", 180], ["search_empty", 95], ["source", 88], ["unfollow", 31],
      ["install", 26], ["follow_parti", 22], ["methode_open", 9],
    ], echelle),
    appareils: top([["mobile", 25200], ["desktop", 9800], ["tablet", 1100]], echelle),
    tops: {
      scrutin: top([["S1", 412], ["S2", 288], ["S3", 251], ["S4", 190], ["S5", 143], ["S6", 97]], echelle),
      depute: top([["D1", 305], ["D2", 266], ["D3", 199], ["D4", 151], ["D5", 122], ["D6", 98]], echelle),
      parti: top([["G1", 260], ["G2", 241], ["G3", 188], ["G4", 160], ["G5", 102], ["G6", 77]], echelle),
      theme: top([["eco", 212], ["sante", 160], ["ecologie", 141], ["securite", 120], ["education", 96], ["solidarites", 81]], echelle),
      search: top([["retraites", 92], ["budget 2027", 71], ["immigration", 58], ["smic", 44], ["logement", 39], ["chat control", 31]], echelle),
      search_empty: top([["vote du 14 juillet", 12], ["ma circonscription", 9], ["sénat", 7]], echelle),
      confront: top([["D1|D2", 64], ["D3|D4", 41], ["D1|D5", 33], ["D2|D6", 21]], echelle),
      screen: top([["search", 6900], ["themes", 4100], ["testResultat", 2300], ["partis", 1900], ["test", 1700], ["apropos", 640]], echelle),
      follow: top([["D1", 41], ["D3", 33], ["D2", 28], ["D6", 12]], echelle),
      unfollow: top([["D3", 6], ["D2", 4]], echelle),
      follow_parti: top([["G2", 9], ["G1", 7]], echelle),
      unfollow_parti: top([["G1", 1]], echelle),
    },
  };
  const noms: Noms = {
    depute: new Map([["D1", "Camille Martin"], ["D2", "Louis Bernard"], ["D3", "Inès Robert"], ["D4", "Hugo Petit"], ["D5", "Léa Durand"], ["D6", "Nathan Moreau"]]),
    parti: new Map([["G1", "Groupe A"], ["G2", "Groupe B"], ["G3", "Groupe C"], ["G4", "Groupe D"], ["G5", "Groupe E"], ["G6", "Groupe F"]]),
    scrutin: new Map([
      ["S1", "Projet de loi de finances pour 2027 (vote sur l'ensemble)"],
      ["S2", "Proposition de loi visant à protéger les mineurs en ligne"],
      ["S3", "Projet de loi de financement de la sécurité sociale pour 2027"],
      ["S4", "Motion de censure déposée en application de l'article 49, alinéa 3"],
      ["S5", "Proposition de loi relative au logement étudiant"],
      ["S6", "Proposition de loi sur la qualité de l'eau potable"],
    ]),
    theme: new Map([["eco", "Économie & finances"], ["sante", "Santé"], ["ecologie", "Écologie"], ["securite", "Sécurité & justice"], ["education", "Éducation"], ["solidarites", "Solidarités"]]),
  };
  return { ...assembler(brut, noms), demo: true };
}

export default {
  fetch(request: Request, env: EnvServeur): Promise<Response> {
    return servir(request, env, async (j) => donneesDemo(Math.min(90, j)), JALONS);
  },
};
