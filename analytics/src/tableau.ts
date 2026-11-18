/**
 * Rendu HTML du tableau de bord privé (/stats). Module PUR : reçoit des données déjà agrégées
 * (`Donnees`, cf. donnees.ts ou demo.ts) et renvoie une page complète.
 *
 * Contraintes :
 *  - AUCUN <script> : la CSP de /stats interdit tout script. Les onglets du classement sont des
 *    `input` radio + `:checked`, la période des liens `?days=`.
 *  - Tient sans défiler sur 1280 × 720 (fenêtre Chrome d'un MacBook Air, barres comprises, soit
 *    environ 600 px de haut utiles) ; empilé et défilant sur mobile.
 *  - Fond sombre, accent citron unique (chiffres clés, série principale, hausses). Aucune
 *    couleur de parti : la couleur n'encode que la donnée.
 *  - Toute chaîne venue des données passe par `esc()` (le texte des recherches est une entrée
 *    non fiable : XSS stockée corrigée en v1.0.63).
 */

export interface Compte {
  visites: number;
  visitesInstagram: number;
  visitesPartage: number;
  /** Visites arrivées sur un résultat du test partagé (entrée « test », source « partage »). */
  visitesPartageTest: number;
  testsCommences: number;
  testsTermines: number;
  partagesReussis: number;
  /** Résultats du test partagés avec succès : image du spectre (story) ou lien du résultat. */
  partagesSpectre: number;
}

export interface Jalon {
  /** AAAA-MM-JJ */
  date: string;
  libelle: string;
}

export interface LigneClassement {
  libelle: string;
  n: number;
  /** Infobulle (nom complet, détail) ; par défaut le libellé. */
  detail?: string;
}

export interface Classement {
  id: string;
  onglet: string;
  titre: string;
  lignes: LigneClassement[];
}

export interface Donnees {
  jours: number;
  /** epoch ms */
  maintenant: number;
  /** Première visite mesurée (événement `arrivee`), epoch ms ; null = aucune encore. */
  debutMesure: number | null;
  /** Début des chiffres clés, de l'entonnoir et de la provenance : max(début de période, début de mesure). */
  debutCompte: number;
  courant: Compte;
  /** Même durée juste avant ; null = non comparable (cf. `raisonND`). */
  precedent: Compte | null;
  raisonND: string;
  /** Un point par jour (UTC) de la période, du plus ancien au plus récent. */
  activite: { jour: string; visites: number; tests: number }[];
  /** Visites par source brute (valeurs de SOURCES, ou « autre »). */
  provenance: Record<string, number>;
  appareils: Record<string, number>;
  totalEvenements: number;
  classements: Classement[];
  /** Types d'événements hors chiffres clés et hors onglets : visibles d'office. */
  autres: { type: string; n: number }[];
  demo?: boolean;
}

// --- Formats ---

const JOUR = 86_400_000;

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]!);

const nf = (n: number): string => Math.round(n).toLocaleString("fr-FR");
const NNBSP = "\u202f";
const pct = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}${NNBSP}%` : "—");
const dec1 = (n: number): string => n.toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

const fmt = (ms: number, o: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o }).format(new Date(ms));
const dateCourte = (ms: number) => fmt(ms, { day: "numeric", month: "short" });
const jourCle = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const jourDeCle = (cle: string) => Date.parse(`${cle}T00:00:00Z`);

/** Écart avec la période précédente : flèche + %, ou n/d. Hausse en citron, baisse en gris clair. */
function ecart(cur: number, prev: number | null, raison: string): string {
  if (prev === null) return `<span class="ec nd" title="Comparaison indisponible : ${esc(raison)}">n/d</span>`;
  if (prev === 0) {
    return cur === 0
      ? `<span class="ec eg" title="Période précédente : 0">= 0${NNBSP}%</span>`
      : `<span class="ec nd" title="Période précédente : 0">n/d</span>`;
  }
  const v = Math.round(((cur - prev) / prev) * 100);
  const t = `Période précédente : ${nf(prev)}`;
  if (v > 0) return `<span class="ec up" title="${t}">↑ ${v}${NNBSP}%</span>`;
  if (v < 0) return `<span class="ec dn" title="${t}">↓ ${-v}${NNBSP}%</span>`;
  return `<span class="ec eg" title="${t}">= 0${NNBSP}%</span>`;
}

// --- Libellés ---

/** Provenance : sources regroupées en lignes lisibles, ordre fixe (comparable d'une semaine à l'autre). */
export const GROUPES_PROVENANCE: { libelle: string; sources: string[]; noms?: string[] }[] = [
  { libelle: "Lien partagé", sources: ["partage"] },
  { libelle: "Instagram · bio", sources: ["insta_bio"] },
  { libelle: "Instagram · story", sources: ["insta_story"] },
  { libelle: "Instagram · post", sources: ["insta_post"] },
  { libelle: "Instagram · autre lien", sources: ["instagram"] },
  { libelle: "Moteurs", sources: ["google", "bing"], noms: ["Google", "Bing"] },
  { libelle: "Pages Scrutoir (SEO)", sources: ["pages_seo"] },
  { libelle: "Autres réseaux", sources: ["facebook", "threads", "x", "linkedin"], noms: ["Facebook", "Threads", "X", "LinkedIn"] },
  { libelle: "Appli installée", sources: ["pwa"] },
  { libelle: "Accès direct", sources: ["direct"] },
  { libelle: "Autres", sources: ["autre_site", "autre_lien", "autre"], noms: ["Autres sites", "Lien inconnu", "Hors liste"] },
];

/** Libellés des types d'événements (onglet « Autres ») ; un type inconnu garde son nom brut. */
export const META: Record<string, string> = {
  screen: "Écrans vus",
  depute: "Fiches député",
  scrutin: "Fiches scrutin",
  parti: "Fiches parti",
  theme: "Thèmes",
  confront: "Duels",
  follow: "Suivis député +",
  unfollow: "Suivis député −",
  follow_parti: "Suivis groupe +",
  unfollow_parti: "Suivis groupe −",
  search: "Recherches",
  search_empty: "Recherches sans résultat",
  source: "Clics vers l'Assemblée",
  install: "Installations de l'appli",
  shuffle: "Tirages surprise (duels)",
  test_start: "Tests commencés",
  test_done: "Tests terminés",
  share: "Partages",
  arrivee: "Visites",
  parcours_open: "Parcours d'une loi ouvert",
  parcours_close: "Parcours d'une loi fermé",
  presidentielle_open: "Présidentielle · accueil",
  programme_open: "Présidentielle · programme",
  chapitre_open: "Présidentielle · chapitre",
  mesure_open: "Présidentielle · mesure",
  selection: "Présidentielle · sélection",
  filtre: "Présidentielle · filtre",
  methode_open: "Présidentielle · méthode",
};

// --- Morceaux de page ---

// Logo Scrutoir (hémicycle) en négatif : sièges clairs, le siège du flanc droit (rang extérieur,
// index 2) évidé au contour citron, comme l'ouverture sombre de l'appli.
const LOGO = `<svg class="logo" viewBox="0 0 200 144" width="30" height="22" aria-hidden="true">${[
  [188, 120.96], [182.69, 90.86], [167.41, 64.39], [144, 44.75], [115.28, 34.3], [84.72, 34.3], [56, 44.75],
  [32.59, 64.39], [17.31, 90.86], [12, 120.96], [162, 120.96], [155.86, 94.06], [138.66, 72.49], [113.8, 60.51],
  [86.2, 60.51], [61.34, 72.49], [44.14, 94.06], [38, 120.96],
]
  .map(([x, y], i) =>
    i === 2
      ? `<circle cx="${x}" cy="${y}" r="7.6" fill="none" stroke="#C8FF2E" stroke-width="3.2"/>`
      : `<circle cx="${x}" cy="${y}" r="9.2" fill="#F2F4F7"/>`,
  )
  .join("")}<circle cx="100" cy="120.96" r="20" fill="#F2F4F7"/></svg>`;

function tete(d: Donnees): string {
  const periode = (n: number, l: string) =>
    `<a href="?days=${n}"${n === d.jours ? ` class="on" aria-current="page"` : ""}>${l}</a>`;
  const maj = fmt(d.maintenant, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  // Période commencée avant la mesure des visites et des partages : chiffres clés, entonnoir et
  // provenance partent de la première visite mesurée. Dit une fois, ici.
  const tronque = d.debutCompte > d.maintenant - d.jours * JOUR + 3_600_000;
  const depuis = tronque
    ? `<p class="dep" title="Chiffres clés, entonnoir et provenance : depuis la première visite mesurée">Visites et partages mesurés depuis le ${esc(dateCourte(d.debutCompte))}</p>`
    : "";
  return `<header class="tete">
    ${LOGO}<h1>Scrutoir <span>·</span> Audience</h1>
    ${d.demo ? `<span class="demo">Données de démonstration</span>` : ""}
    <nav class="periodes" aria-label="Période">${periode(7, "7 j")}${periode(30, "30 j")}${periode(90, "90 j")}</nav>
    ${depuis}
    <p class="maj">Mis à jour le ${esc(maj)}</p>
  </header>`;
}

function kpis(d: Donnees): string {
  const c = d.courant, p = d.precedent, r = d.raisonND;
  const carte = (titre: string, val: number, prev: number | null, sous: string, aide: string) => `
    <article class="carte kpi" title="${esc(aide)}">
      <div class="kt"><h2>${titre}</h2>${ecart(val, prev, r)}</div>
      <p class="kv">${nf(val)}</p>
      <p class="ks">${sous}</p>
    </article>`;
  return `<section class="kpis" aria-label="Chiffres clés">
    ${carte("Visites", c.visites, p?.visites ?? null,
      c.visites ? `dont Instagram <b>${nf(c.visitesInstagram)}</b> · ${pct(c.visitesInstagram, c.visites)}` : "Aucune visite mesurée",
      "Une visite = un chargement de l'appli (un onglet), rechargements non recomptés.")}
    ${carte("Tests terminés", c.testsTermines, p?.testsTermines ?? null,
      `<b>${pct(c.testsTermines, c.testsCommences)}</b> des tests commencés`,
      "Taux de fin = tests terminés / tests commencés (un test « affiner » compte comme un test).")}
    ${carte("Partages réussis", c.partagesReussis, p?.partagesReussis ?? null,
      `résultat partagé après <b>${pct(c.partagesSpectre, c.testsTermines)}</b> des tests`,
      "Partis par la feuille de partage, copiés ou téléchargés. Taux = résultats du test partagés (image du spectre ou lien) / tests terminés.")}
    ${carte("Visites via un partage", c.visitesPartage, p?.visitesPartage ?? null,
      c.partagesReussis ? `<b>${dec1(c.visitesPartage / c.partagesReussis)}</b> visite par partage` : "— visite par partage",
      "Visites arrivées par un lien partagé depuis Scrutoir, rapportées aux partages réussis : la boucle de diffusion.")}
  </section>`;
}

/** Arrondi « joli » au-dessus de m (1, 2, 2,5, 5 × 10ⁿ). */
function echelle(m: number): number {
  if (m <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= m) return k * p;
  return 10 * p;
}

function graphique(d: Donnees, jalons: Jalon[]): string {
  const pts = d.activite;
  const N = pts.length || 1;
  const max = echelle(Math.max(1, ...pts.map((p) => Math.max(p.visites, p.tests))));
  const x = (i: number) => ((i + 0.5) / N) * 100;
  const idx = (cle: string) => pts.findIndex((p) => p.jour === cle);

  const barres = pts
    .map((p) => {
      const h = (p.visites / max) * 100;
      const t = `${dateCourte(jourDeCle(p.jour))} : ${nf(p.visites)} visite${p.visites > 1 ? "s" : ""} · ${nf(p.tests)} test${p.tests > 1 ? "s" : ""} terminé${p.tests > 1 ? "s" : ""}`;
      return `<div class="j" title="${esc(t)}"><span style="height:${h.toFixed(2)}%"></span></div>`;
    })
    .join("");
  const ligne = pts.map((p, i) => `${(i + 0.5).toFixed(2)},${(100 - (p.tests / max) * 100).toFixed(2)}`).join(" ");

  // Avant la première visite mesurée : zone hachurée (aucune visite n'y était comptée).
  let avant = "";
  if (d.debutMesure !== null) {
    const i0 = pts.findIndex((p) => jourDeCle(p.jour) + JOUR > d.debutMesure!);
    if (i0 > 0) avant = `<div class="avant" style="width:${((i0 / N) * 100).toFixed(2)}%" title="Visites mesurées depuis le ${esc(dateCourte(d.debutMesure))}"></div>`;
  } else if (pts.length) {
    avant = `<div class="avant" style="width:100%" title="Aucune visite mesurée sur la période"></div>`;
  }

  const marques = jalons
    .map((j) => ({ j, i: idx(j.date) }))
    .filter((m) => m.i >= 0)
    .map((m, k) => {
      const g = x(m.i) > 62 ? " g" : "";
      return `<div class="jalon${g}" style="left:${x(m.i).toFixed(2)}%"><b style="top:${k % 2 ? 13 : 0}px" title="${esc(`${dateCourte(jourDeCle(m.j.date))} : ${m.j.libelle}`)}">${esc(m.j.libelle)}</b></div>`;
    })
    .join("");

  const pas = N <= 8 ? 1 : N <= 31 ? 5 : 15;
  const graduations = pts
    .map((p, i) => ((N - 1 - i) % pas === 0 ? `<span style="left:${x(i).toFixed(2)}%">${esc(fmt(jourDeCle(p.jour), { day: "numeric", month: "numeric" }))}</span>` : ""))
    .join("");

  return `<section class="carte graph" aria-label="Activité quotidienne">
    <div class="ttr"><h2>Activité quotidienne</h2>
      <p class="leg"><span class="lv"></span>Visites <span class="lt"></span>Tests terminés</p></div>
    <div class="zone">
      <div class="trace">
        <div class="grille" style="top:0"><i>${nf(max)}</i></div>
        <div class="grille" style="top:50%"><i>${nf(max / 2)}</i></div>
        ${avant}
        <div class="barres">${barres}</div>
        <svg class="ligne" viewBox="0 0 ${N} 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${ligne}" fill="none" stroke="#F2F4F7" stroke-opacity=".8" stroke-width="1.75" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>
        ${marques}
      </div>
      <div class="axe">${graduations}</div>
    </div>
  </section>`;
}

function entonnoir(d: Donnees): string {
  const c = d.courant;
  const etapes: [string, number, string][] = [
    ["Visites", c.visites, "Chargements de l'appli"],
    ["Tests commencés", c.testsCommences, "Ouvertures du test (complet, par thème ou « affiner »)"],
    ["Tests terminés", c.testsTermines, "Tests menés jusqu'au résultat"],
    ["Résultats partagés", c.partagesSpectre, "Image du spectre en story ou lien du résultat, partis avec succès"],
    ["Visites via un résultat", c.visitesPartageTest, "Visites arrivées par un lien de résultat partagé"],
  ];
  const base = Math.max(1, c.visites);
  const html = etapes
    .map(([l, n, aide], i) => {
      const fleche =
        i === 0
          ? ""
          : `<li class="pas" aria-label="Passage : ${pct(n, etapes[i - 1][1])}"><svg viewBox="0 0 16 10" width="16" height="10" aria-hidden="true"><path d="M1 5h12M9 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><b>${pct(n, etapes[i - 1][1])}</b></li>`;
      const w = Math.min(100, (n / base) * 100);
      return `${fleche}<li class="et" title="${esc(aide)}"><p class="ev">${nf(n)}</p><p class="el">${l}</p><span class="er"><i style="width:${w.toFixed(1)}%"></i></span></li>`;
    })
    .join("");
  return `<section class="carte ent" aria-label="Entonnoir du test"><h2>Entonnoir du test</h2><ol>${html}</ol></section>`;
}

function provenance(d: Donnees): string {
  const total = Object.values(d.provenance).reduce((s, n) => s + n, 0);
  const lignes = GROUPES_PROVENANCE.map((g) => {
    const parts = g.sources.map((s) => d.provenance[s] ?? 0);
    return { g, n: parts.reduce((s, n) => s + n, 0), parts };
  });
  const max = Math.max(1, ...lignes.map((l) => l.n));
  const rangs = lignes
    .map(({ g, n, parts }) => {
      const detail = g.noms ? g.noms.map((nm, i) => `${nm} ${nf(parts[i])}`).join(" · ") : `${g.libelle} : ${nf(n)}`;
      return `<div class="ln${n ? "" : " zero"}" title="${esc(detail)}"><span class="lb">${esc(g.libelle)}</span><span class="rl"><i style="width:${((n / max) * 100).toFixed(1)}%"></i></span><span class="nb">${nf(n)}</span><span class="pc">${total ? pct(n, total) : ""}</span></div>`;
    })
    .join("");
  return `<section class="carte prov" aria-label="Provenance des visites">
    <div class="ttr"><h2>Provenance des visites</h2><p class="note">${nf(total)} visite${total > 1 ? "s" : ""}</p></div>
    <div class="lignes">${rangs}</div>
  </section>`;
}

function classements(d: Donnees): string {
  const onglets = [...d.classements];
  onglets.push({
    id: "autres",
    onglet: "Autres",
    titre: "Autres événements",
    lignes: d.autres.map((a) => ({ libelle: META[a.type] ?? a.type, n: a.n, detail: `${a.type} : ${nf(a.n)}` })),
  });
  const radios = onglets.map((o, i) => `<input type="radio" name="cl" id="cl${i}"${i === 0 ? " checked" : ""}>`).join("");
  const libelles = onglets.map((o, i) => `<label for="cl${i}">${esc(o.onglet)}</label>`).join("");
  const panneaux = onglets
    .map((o, i) => {
      const max = Math.max(1, ...o.lignes.map((l) => l.n));
      const deuxCol = o.id === "autres" && o.lignes.length > 6;
      const lignes = (deuxCol ? o.lignes.slice(0, 14) : o.lignes.slice(0, 6))
        .map(
          (l) =>
            `<div class="ln" title="${esc(l.detail ?? l.libelle)}"><span class="lb">${esc(l.libelle)}</span><span class="rl"><i style="width:${((l.n / max) * 100).toFixed(1)}%"></i></span><span class="nb">${nf(l.n)}</span></div>`,
        )
        .join("");
      const reste = deuxCol && o.lignes.length > 14 ? `<p class="vide">+ ${o.lignes.length - 14} autres types</p>` : "";
      return `<div class="pan" id="pa${i}"><h3>${esc(o.titre)}</h3>${lignes ? `<div class="lignes${deuxCol ? " deux" : ""}">${lignes}</div>${reste}` : `<p class="vide">Aucune donnée sur la période</p>`}</div>`;
    })
    .join("");
  const css = onglets
    .map((_, i) => `#cl${i}:checked~.onglets [for=cl${i}]{background:var(--rail);color:var(--txt)}#cl${i}:checked~.panneaux #pa${i}{display:block}#cl${i}:focus-visible~.onglets [for=cl${i}]{outline:2px solid var(--cit);outline-offset:1px}`)
    .join("");
  return `<section class="carte clas" aria-label="Classements"><style>${css}</style>
    <h2>Classements</h2>${radios}<div class="onglets">${libelles}</div><div class="panneaux">${panneaux}</div>
  </section>`;
}

function pied(d: Donnees): string {
  const tot = Object.values(d.appareils).reduce((s, n) => s + n, 0);
  const app = tot
    ? ` · mobile ${pct(d.appareils.mobile ?? 0, tot)} · tablette ${pct(d.appareils.tablet ?? 0, tot)} · ordinateur ${pct(d.appareils.desktop ?? 0, tot)}`
    : "";
  return `<footer class="pied">${nf(d.totalEvenements)} événements sur ${d.jours} j${app} · Données anonymes : sans cookie, sans IP, sans identifiant · n/d : période précédente non comparable (avant le début de la mesure ou au-delà des 3 mois conservés)</footer>`;
}

const CSS = `
@font-face{font-family:Manrope;font-weight:500;font-display:swap;src:url(/stats/polices/manrope-500.ttf) format("truetype")}
@font-face{font-family:Manrope;font-weight:800;font-display:swap;src:url(/stats/polices/manrope-800.ttf) format("truetype")}
:root{--bg:#171A1F;--card:#1F232A;--bord:#2C313A;--rail:#2C323B;--txt:#F2F4F7;--sec:#A0A6B0;--ter:#858C97;--cit:#C8FF2E;color-scheme:dark}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:var(--bg)}
body{color:var(--txt);font:500 13px/1.35 Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
b,h1,h2,strong{font-weight:800}
.page{display:grid;gap:10px;padding:12px 16px;grid-template-columns:minmax(0,1fr);max-width:1480px;margin:0 auto}
.carte{background:var(--card);border:1px solid var(--bord);border-radius:12px;padding:11px 14px;min-width:0;min-height:0}
h2{font-size:12px;letter-spacing:.01em;color:var(--txt)}
h3{font-size:11.5px;font-weight:500;color:var(--sec);margin-bottom:6px}
.ttr{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.note,.leg{font-size:11.5px;color:var(--sec)}
.tete{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;min-height:34px}
.tete h1{font-size:15px;letter-spacing:-.01em;white-space:nowrap}.tete h1 span{color:var(--sec);font-weight:500}
.demo{font-size:11px;color:var(--bg);background:var(--sec);border-radius:999px;padding:2px 8px}
.periodes{display:flex;gap:2px;background:var(--card);border:1px solid var(--bord);border-radius:999px;padding:2px}
.periodes a{color:var(--sec);text-decoration:none;font-size:12px;padding:4px 11px;border-radius:999px}
.periodes a.on{background:var(--txt);color:var(--bg);font-weight:800}
.periodes a:focus-visible{outline:2px solid var(--cit)}
.maj{margin-left:auto;font-size:11.5px;color:var(--sec)}
.kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.kpi{position:relative;display:flex;flex-direction:column;gap:2px}
.kt{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.kt h2{font-weight:500;color:var(--sec)}
.kv{font-size:30px;line-height:1.1;font-weight:800;color:var(--cit);letter-spacing:-.02em}
.ks{font-size:12px;color:var(--sec)}.ks b{color:var(--txt)}
.dep{font-size:11.5px;color:var(--sec)}
.ec{font-size:12px;font-weight:800;white-space:nowrap}.ec.up{color:var(--cit)}.ec.dn{color:#C9CED6}.ec.eg,.ec.nd{color:var(--ter);font-weight:500}
.graph{display:flex;flex-direction:column}
.leg{display:flex;align-items:center;gap:6px}
.leg .lv{display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--cit)}
.leg .lt{display:inline-block;width:14px;height:0;border-top:2px solid rgba(242,244,247,.8);margin-left:8px}
.zone{position:relative;flex:1;min-height:170px;margin-top:6px}
.trace{position:absolute;left:0;right:30px;top:28px;bottom:18px}
.grille{position:absolute;left:0;right:-30px;border-top:1px dashed var(--rail)}
.grille i{position:absolute;right:0;top:-7px;font-style:normal;font-size:10.5px;color:var(--ter);background:var(--card);padding-left:4px}
.barres{position:absolute;inset:0;display:flex;align-items:flex-end;gap:2px}
.barres .j{flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center;min-width:0}
.barres .j span{display:block;width:100%;max-width:30px;background:var(--cit);border-radius:2px 2px 0 0}
.barres .j:hover span{filter:brightness(1.15)}
.ligne{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.avant{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(135deg,transparent 0 6px,rgba(242,244,247,.05) 6px 7px);border-right:1px solid var(--rail)}
.jalon{position:absolute;top:-28px;bottom:0;border-left:1px dashed var(--sec);pointer-events:none}
.jalon b{position:absolute;z-index:2;background:var(--card);padding:0 3px;left:2px;font-size:10.5px;font-weight:500;color:var(--sec);white-space:nowrap;max-width:190px;overflow:hidden;text-overflow:ellipsis;pointer-events:auto}
.jalon.g b{left:auto;right:2px}
.axe{position:absolute;left:0;right:30px;bottom:0;height:14px}
.axe span{position:absolute;transform:translateX(-50%);font-size:10.5px;color:var(--ter);white-space:nowrap}
.ent ol{list-style:none;display:flex;align-items:stretch;gap:6px;margin-top:8px}
.ent .et{flex:1;min-width:0}
.ent .ev{font-size:19px;font-weight:800;line-height:1.1}
.ent .el{font-size:11.5px;color:var(--sec);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ent .er{display:block;height:3px;background:var(--rail);border-radius:2px;margin-top:5px}
.ent .er i{display:block;height:100%;background:var(--txt);opacity:.55;border-radius:2px}
.ent .pas{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--ter);gap:1px;padding:0 2px}
.ent .pas b{font-size:11.5px;color:var(--txt)}
.lignes{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.ln{display:grid;grid-template-columns:minmax(0,1fr) 64px 46px 36px;align-items:center;gap:8px;min-height:20px;font-size:12px}
.clas .ln{grid-template-columns:minmax(0,1fr) 40px 40px}
.ln .lb{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ln .rl{height:6px;background:var(--rail);border-radius:3px;overflow:hidden}
.ln .rl i{display:block;height:100%;background:var(--txt);opacity:.55;border-radius:3px}
.ln .nb{text-align:right;font-weight:800}
.ln .pc{text-align:right;color:var(--sec);font-size:11.5px}
.ln.zero{color:var(--ter)}.ln.zero .nb{font-weight:500}
.clas{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto 1fr;gap:6px}
.clas>input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.onglets{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.onglets label{flex:0 0 auto;font-size:12px;color:var(--sec);padding:4px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
.onglets label:hover{color:var(--txt)}
.pan{display:none}
.lignes.deux{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}
.vide{font-size:12px;color:var(--ter);margin-top:6px}
.pied{font-size:11px;color:var(--ter);line-height:1.4}
@media (min-width:640px){.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:639px){.maj{margin-left:0;width:100%}.ent ol{flex-direction:column}.ent .pas{flex-direction:row;justify-content:flex-start;gap:6px;padding:0}.ent .pas svg{transform:rotate(90deg)}.kv{font-size:26px}}
@media (min-width:1000px){
  .page{grid-template-columns:minmax(0,1.42fr) minmax(0,.95fr) minmax(0,1.25fr);grid-template-rows:auto auto minmax(0,1fr) auto auto;
    grid-template-areas:"tete tete tete" "kpi kpi kpi" "graph prov clas" "ent ent clas" "pied pied pied"}
  .tete{grid-area:tete}.kpis{grid-area:kpi}.graph{grid-area:graph}.prov{grid-area:prov}.clas{grid-area:clas}.ent{grid-area:ent}.pied{grid-area:pied}
  .clas{grid-template-columns:96px minmax(0,1fr);grid-template-rows:auto 1fr;column-gap:12px}
  .clas h2{grid-column:1/-1}
  .onglets{flex-direction:column;overflow:visible;gap:1px}
  .onglets label{padding:3px 8px}
  .prov,.clas{display:grid}
  .prov{grid-template-rows:auto 1fr}
}
@media (min-width:1000px) and (min-height:560px){.page{height:100vh;overflow:hidden}.zone{min-height:0}}
@media (min-width:1360px) and (min-height:820px){
  body{font-size:14px}.page{gap:14px;padding:18px 24px}.carte{padding:14px 18px}
  h2{font-size:13px}.kv{font-size:36px}.ks,.ln{font-size:13px}.ent .ev{font-size:22px}.ent .el{font-size:12.5px}
  .ln{min-height:24px}.lignes{gap:5px}.onglets label{font-size:13px;padding:4px 9px}.clas{grid-template-columns:110px minmax(0,1fr)}
}
`;

/** Page complète. `jalons` : repères du graphique (constante JALONS du Worker). */
export function rendreTableau(d: Donnees, jalons: Jalon[]): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Scrutoir · Audience</title><style>${CSS}</style></head>
<body><main class="page">
${tete(d)}
${kpis(d)}
${graphique(d, jalons)}
${entonnoir(d)}
${provenance(d)}
${classements(d)}
${pied(d)}
</main></body></html>`;
}

/** Jours (UTC) de la période, du plus ancien au plus récent : AAAA-MM-JJ. */
export function joursPeriode(maintenant: number, jours: number): string[] {
  const aujourdhui = jourDeCle(jourCle(maintenant));
  return Array.from({ length: jours }, (_, i) => jourCle(aujourdhui - (jours - 1 - i) * JOUR));
}
