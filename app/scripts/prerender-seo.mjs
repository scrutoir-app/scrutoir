#!/usr/bin/env node
/*
 * Pré-rendu SEO (lot 2). Génère de VRAIES pages HTML statiques, riches en contenu, depuis
 * les JSON déjà exportés sous dist/data/. Tourne après `expo export -p web` et `patch-pwa.mjs`
 * (voir `npm run build:web`). Ces fichiers priment sur le catch-all `/* /index.html 200`
 * de `_redirects` (Cloudflare sert l'asset existant en premier), ce qui donne à l'app — dont
 * la navigation est en mémoire (aucune URL par contenu) — une surface indexable réelle.
 *
 * Pages : 577 députés, 12 thèmes, 12 partis, 75 grands scrutins + 4 hubs (listes crawlables).
 * Chaque page : <title>/<meta description> uniques, canonical, Open Graph, JSON-LD
 * (Person / Organization / CollectionPage + BreadcrumbList), maillage interne et CTA vers l'app.
 * Le sitemap complet (toutes ces URLs + l'accueil) est écrit ici.
 *
 * Neutralité : la couleur n'encode QUE le vote (pour/contre/abstention) — jamais un parti
 * ou un thème. On n'affiche pas de « score de loyauté » en vedette (cohérent avec l'app) :
 * on s'en tient aux faits (participation, votes par thème, consigne de groupe).
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const dataDir = join(distDir, "data");
const SITE = "https://scrutoir.fr";

// Couleurs de vote (les SEULES couleurs porteuses de sens, cf. règle de neutralité).
const COL = { pour: "#2F8F5B", contre: "#C44536", abstention: "#D6A43C" };

// Lot 6 — pages député×thème. DEUX contraintes :
//  1) Qualité (anti thin content, audit §5) : au moins ce nombre de votes EXPRIMÉS sur le thème.
//  2) Budget fichiers : Cloudflare Pages plafonne à 20 000 fichiers PAR projet. Depuis la
//     séparation en deux projets (split-data-site.mjs : /data → « scrutoir-data »), le projet
//     app ne porte plus que le bundle + les pages SEO (~1 page/scrutin) — DEPUTE_THEME_MAX
//     peut être relevé si le comptage en fin de script laisse de la marge.
const DEPUTE_THEME_INDEX_MIN = 10;
const DEPUTE_THEME_MAX = 3;
const CF_PAGES_FILE_LIMIT = 20000;
const POS_LABEL = { pour: "Pour", contre: "Contre", abstention: "Abstention", nonvotant: "Non votant", absent: "Absent" };

// ---------- helpers ----------
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Sérialise un objet pour un <script type="application/ld+json"> : JSON.stringify
// n'échappe pas `<`, donc un titre/nom contenant `</script>` casserait la page.
// On échappe `< > &` et les séparateurs de ligne Unicode en \uXXXX (JSON reste valide).
const jsonLd = (obj) =>
  JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const slugify = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const readJSON = async (p) => JSON.parse(await readFile(p, "utf8"));
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${+d} ${MOIS[+m - 1]} ${y}`;
};
const trunc = (s, n) => {
  s = String(s ?? "").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Picto hémicycle (même géométrie que ScrutoirMark, siège blanc contour encre).
function markSvg(size = 28) {
  const w = size, h = w * 0.72, cx = w / 2, cy = h * 0.84, rings = [w * 0.44, w * 0.31];
  const dotR = w * 0.046, sw = Math.max(1, w * 0.0085);
  let dots = "";
  rings.forEach((R, ri) => {
    const n = 9 - ri * 2;
    for (let i = 0; i <= n; i++) {
      const t = Math.PI * (i / n);
      const x = (cx + R * Math.cos(t)).toFixed(2), y = (cy - R * Math.sin(t)).toFixed(2);
      dots += ri === 0 && i === 2
        ? `<circle cx="${x}" cy="${y}" r="${dotR.toFixed(2)}" fill="#fff" stroke="#171A1F" stroke-width="${sw.toFixed(2)}"/>`
        : `<circle cx="${x}" cy="${y}" r="${dotR.toFixed(2)}" fill="#171A1F"/>`;
    }
  });
  dots += `<circle cx="${cx}" cy="${cy.toFixed(2)}" r="${(w * 0.1).toFixed(2)}" fill="#3C4654"/>`;
  return `<svg width="${w}" height="${h.toFixed(0)}" viewBox="0 0 ${w} ${h.toFixed(2)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${dots}</svg>`;
}

function voteBar(pour, contre, abst) {
  const t = (pour || 0) + (contre || 0) + (abst || 0) || 1;
  const seg = (n, c, l) =>
    n > 0 ? `<span class="seg" style="width:${((n / t) * 100).toFixed(1)}%;background:${c}" title="${l} : ${n}"></span>` : "";
  return `<div class="bar" role="img" aria-label="Pour ${pour}, contre ${contre}, abstention ${abst}">${seg(pour, COL.pour, "Pour")}${seg(contre, COL.contre, "Contre")}${seg(abst, COL.abstention, "Abstention")}</div>`;
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#171A1F;background:#F2F4F7;line-height:1.55}
a{color:#3C4654}
.hd{display:flex;align-items:center;padding:14px 18px;background:#fff;border-bottom:1px solid #E5E8EC}
.hd .brand{display:flex;align-items:center;gap:9px;text-decoration:none;color:#171A1F;font-weight:800;font-size:20px;letter-spacing:.3px}
.bc{max-width:760px;margin:0 auto;padding:14px 18px 0}
.bc ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;font-size:13px;color:#5A626E}
.bc a{color:#5A626E}
.bc li:not(:last-child)::after{content:"›";margin-left:6px;color:#9AA1AB}
main{max-width:760px;margin:0 auto;padding:6px 18px 36px}
h1{font-size:26px;letter-spacing:-.4px;margin:12px 0 4px}
h2{font-size:17px;margin:24px 0 10px}
.sub{color:#5A626E;margin:0 0 16px;font-size:15px}
.card{background:#fff;border:1px solid #E5E8EC;border-radius:14px;padding:16px;margin:0 0 14px}
.stats{display:flex;flex-wrap:wrap;gap:18px;margin:0}
.stat b{display:block;font-size:22px;letter-spacing:-.3px}
.stat span{font-size:12px;color:#5A626E}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #EEF0F3}
th{font-size:12px;color:#5A626E;font-weight:600}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:#EEF0F3;margin:10px 0}
.bar .seg{display:block;height:100%}
.legend{font-size:12px;color:#5A626E;display:flex;gap:14px;flex-wrap:wrap}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:middle}
.badge{display:inline-block;padding:3px 11px;border-radius:999px;font-size:13px;font-weight:700;color:#fff}
.photo{width:92px;height:92px;border-radius:16px;object-fit:cover;background:#EEF0F3;float:right;margin:0 0 10px 14px}
ul.links{columns:2;column-gap:24px;list-style:none;padding:0;margin:0}
ul.links li{margin:0 0 7px;break-inside:avoid}
.cta{margin:20px 0 0}
.cta a{display:inline-block;background:#3C4654;color:#fff;text-decoration:none;padding:11px 17px;border-radius:12px;font-weight:600}
.ft{max-width:760px;margin:0 auto;padding:20px 18px 32px;color:#7A828D;font-size:12px;border-top:1px solid #E5E8EC}
.ft a{color:#5A626E}
@media(max-width:520px){ul.links{columns:1}h1{font-size:23px}}
`;

function breadcrumbLd(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.url ? { item: SITE + c.url } : {}),
    })),
  };
}

function crumbsHtml(crumbs) {
  return (
    `<nav class="bc" aria-label="Fil d'Ariane"><ol>` +
    crumbs.map((c) => `<li>${c.url ? `<a href="${c.url}">${esc(c.name)}</a>` : `<span>${esc(c.name)}</span>`}</li>`).join("") +
    `</ol></nav>`
  );
}

function shell({ title, description, path, ogImage, ogType = "website", jsonld, crumbs, h1, sub, main, noindex = false }) {
  const canonical = SITE + path;
  const ld = [breadcrumbLd(crumbs), ...(jsonld ? [jsonld] : [])];
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${noindex ? `<meta name="robots" content="noindex,follow">\n` : ""}<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Scrutoir">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:locale" content="fr_FR">
<meta property="og:image" content="${ogImage || SITE + "/og.png"}">
<meta name="twitter:card" content="${ogImage && ogType === "profile" ? "summary" : "summary_large_image"}">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<style>${CSS}</style>
<script type="application/ld+json">${jsonLd(ld)}</script>
</head>
<body>
<header class="hd"><a class="brand" href="/">${markSvg(28)}<span>Scrutoir</span></a></header>
${crumbsHtml(crumbs)}
<main>
<h1>${esc(h1)}</h1>
${sub ? `<p class="sub">${sub}</p>` : ""}
${main}
<p class="cta"><a href="/">Ouvrir la fiche interactive dans l'application →</a></p>
</main>
<footer class="ft">
Source : <a href="https://data.assemblee-nationale.fr" rel="nofollow noopener">Open Data de l'Assemblée nationale</a> (licence Etalab, mise à jour quotidienne), 17ᵉ législature.
Scrutoir est un service citoyen <strong>neutre, gratuit et sans publicité</strong> : aucune couleur de parti n'est mise en avant, seul le vote parle.
Les chiffres ne portent que sur les <strong>scrutins publics nominatifs</strong> et ne reflètent qu'une partie de l'activité d'un député — à lire avec nuance.
</footer>
</body>
</html>`;
}

async function writePage(path, html) {
  const dir = join(distDir, path.replace(/^\/|\/$/g, ""));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), html, "utf8");
}

// ---------- générateurs ----------
const urls = []; // pour le sitemap : { path, priority, changefreq }
const add = (path, priority, changefreq = "weekly") => urls.push({ path, priority, changefreq });

async function genDeputes(scrutinMap, themesMeta) {
  const list = await readJSON(join(dataDir, "deputes.json"));
  // Slugs uniques et STABLES : nom seul si unique, sinon désambiguïsé par département-circo
  // (un même nom dans la même circo est impossible — un seul siège).
  const count = {};
  list.forEach((d) => (count[slugify(d.nom_complet)] = (count[slugify(d.nom_complet)] || 0) + 1));
  const slugOf = (d) => {
    const base = slugify(d.nom_complet);
    return count[base] > 1 ? `${base}-${slugify(d.departement)}-${d.circo}` : base;
  };

  const items = []; // pour le hub, groupé par parti
  let dtIndexed = 0; // compteur pages député×thème (lot 6)
  for (const d of list) {
    const slug = slugOf(d);
    const path = `/depute/${slug}/`;
    items.push({ ...d, slug });

    let detail = null;
    try {
      detail = await readJSON(join(dataDir, "depute", `${d.uid}.json`));
    } catch {
      /* fiche détaillée absente → page allégée */
    }
    const p = detail?.profils?.all || null;
    const cats = (p?.categories || []).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    // Lot 6 : on range les votes EXPRIMÉS du député par thème (via la carte scrutin→catégorie).
    const buckets = {}; // themeId -> [{ numero, titre, date, position, consigne }]
    for (const [suid, tuple] of Object.entries(detail?.votes || {})) {
      const pos = Array.isArray(tuple) ? tuple[0] : tuple;
      if (pos !== "pour" && pos !== "contre" && pos !== "abstention") continue;
      const sc = scrutinMap[suid];
      if (!sc || !sc.cat) continue;
      (buckets[sc.cat] ||= []).push({ numero: sc.numero, titre: sc.titre, date: sc.date, position: pos, consigne: Array.isArray(tuple) ? tuple[1] : null });
    }
    // On ne génère que les N thèmes les plus actifs du député (≥ seuil), pour la qualité ET
    // pour tenir sous la limite de fichiers Cloudflare Pages.
    const dtThemes = Object.entries(buckets)
      .filter(([, rows]) => rows.length >= DEPUTE_THEME_INDEX_MIN)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, DEPUTE_THEME_MAX)
      .map(([id]) => id);
    const dtSet = new Set(dtThemes);

    const statsHtml = p
      ? `<div class="card"><div class="stats">
          <div class="stat"><b>${p.participation_pct}%</b><span>participation aux scrutins</span></div>
          ${p.participation_rang_pct != null ? `<div class="stat"><b>${p.participation_rang_pct}%</b><span>plus assidu·e que ce % des députés</span></div>` : ""}
          ${detail?.mandat_debut ? `<div class="stat"><b>${fmtDate(detail.mandat_debut)}</b><span>début du mandat</span></div>` : ""}
        </div></div>`
      : "";

    const themesTable = cats.length
      ? `<h2>Votes par thème</h2>
         <div class="card"><table>
         <thead><tr><th>Thème</th><th class="n">Pour</th><th class="n">Contre</th><th class="n">Abst.</th><th class="n">Absent</th></tr></thead>
         <tbody>${cats
           .map(
             (c) =>
               `<tr><td><a href="${dtSet.has(c.id) ? `/depute/${slug}/${esc(c.id)}/` : `/theme/${esc(c.id)}/`}">${esc(c.libelle)}</a></td><td class="n">${c.pour}</td><td class="n">${c.contre}</td><td class="n">${c.abstention}</td><td class="n">${c.absent}</td></tr>`,
           )
           .join("")}</tbody></table>
         <p class="legend" style="margin-top:10px">Décompte des scrutins publics nominatifs par grand thème. « Absent » est déduit et borné aux dates du mandat.</p>
         </div>`
      : "";

    const dissN = (detail?.dissidences || []).length;
    const dissHtml = dissN
      ? `<p>${esc(d.nom_complet)} s'est écarté·e de la consigne de son groupe sur <strong>${dissN} scrutin${dissN > 1 ? "s" : ""}</strong> (dissidences) — détail dans l'application.</p>`
      : "";

    const partiSlug = slugify(d.abrev || d.groupe);
    const main = `
      ${d.photo_url ? `<img class="photo" src="${esc(d.photo_url)}" alt="${esc(d.nom_complet)}" width="92" height="92" loading="lazy">` : ""}
      <p>${esc(d.nom_complet)} est député·e de la 17ᵉ législature, élu·e dans la circonscription ${esc(d.circo)} ${esc(d.departement ? "de " + d.departement : "")} (${esc(d.num_departement)}), membre du groupe <a href="/parti/${esc(partiSlug)}/">${esc(d.groupe)}${d.abrev ? ` (${esc(d.abrev)})` : ""}</a>.</p>
      ${statsHtml}
      ${themesTable}
      ${dissHtml}
      <p><a href="/deputes/">← Tous les députés</a></p>`;

    const title = `${d.nom_complet}${d.abrev ? ` (${d.abrev})` : ""} — ses votes à l'Assemblée | Scrutoir`;
    const description = `Comment a voté ${d.nom_complet}, député·e ${d.groupe}${d.departement ? ` (${d.departement})` : ""} ? Participation, votes par thème et dissidences, à partir des scrutins publics nominatifs de l'Assemblée nationale.`;
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: d.nom_complet,
      ...(d.photo_url ? { image: SITE + d.photo_url } : {}),
      jobTitle: "Député à l'Assemblée nationale",
      memberOf: { "@type": "Organization", name: d.groupe, ...(d.abrev ? { alternateName: d.abrev } : {}) },
      ...(d.departement ? { workLocation: { "@type": "Place", name: `${d.departement} (circonscription ${d.circo})` } } : {}),
      url: SITE + path,
    };

    await writePage(
      path,
      shell({
        title,
        description,
        path,
        ogImage: d.photo_url ? SITE + d.photo_url : undefined,
        ogType: "profile",
        jsonld,
        crumbs: [{ name: "Accueil", url: "/" }, { name: "Députés", url: "/deputes/" }, { name: d.nom_complet }],
        h1: d.nom_complet,
        sub: `Député·e — ${esc(d.groupe)}${d.abrev ? ` (${esc(d.abrev)})` : ""} · ${esc(d.departement)} (${esc(d.num_departement)}-${esc(d.circo)})`,
        main,
      }),
    );
    add(path, "0.7");

    // Lot 6 : une page par (député, thème) parmi les thèmes retenus (top N, ≥ seuil).
    for (const themeId of dtThemes) {
      const rows = buckets[themeId];
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const expressed = rows.length;
      const tLib = themesMeta[themeId]?.libelle || themeId;
      const dtPath = `/depute/${slug}/${themeId}/`;
      const shown = rows.slice(0, 300);
      const tbody = shown
        .map((r) => {
          const ecart =
            r.consigne && r.consigne !== r.position && (r.consigne === "pour" || r.consigne === "contre") && (r.position === "pour" || r.position === "contre")
              ? ` <span style="color:#9AA1AB">· ≠ groupe</span>`
              : "";
          return `<tr><td style="white-space:nowrap;color:#5A626E">${fmtDate(r.date)}</td><td><a href="/scrutin/${r.numero}/">${esc(trunc(r.titre, 90))}</a></td><td style="white-space:nowrap"><b style="color:${COL[r.position] || "#5A626E"}">${POS_LABEL[r.position] || r.position}</b>${ecart}</td></tr>`;
        })
        .join("");
      const dtMain = `
        <p>Le détail des <strong>${expressed} vote${expressed > 1 ? "s" : ""} exprimé${expressed > 1 ? "s" : ""}</strong> de ${esc(d.nom_complet)} (${esc(d.abrev || d.groupe)}) sur les scrutins publics du thème « ${esc(tLib)} », du plus récent au plus ancien. « ≠ groupe » signale un écart avec la consigne du groupe.</p>
        <div class="card"><table>
          <thead><tr><th>Date</th><th>Scrutin</th><th>Vote</th></tr></thead>
          <tbody>${tbody}</tbody>
        </table>${rows.length > shown.length ? `<p class="legend" style="margin-top:10px">Affichage des ${shown.length} votes les plus récents sur ${rows.length}.</p>` : ""}</div>
        <p><a href="/depute/${slug}/">← Fiche de ${esc(d.nom_complet)}</a> · <a href="/theme/${esc(themeId)}/">Thème ${esc(tLib)}</a></p>`;
      await writePage(
        dtPath,
        shell({
          title: `${d.nom_complet} et le thème ${tLib} — ses votes | Scrutoir`,
          description: `Les ${expressed} votes de ${d.nom_complet} (${d.abrev || d.groupe}) sur le thème « ${tLib} » à l'Assemblée nationale : le détail scrutin par scrutin.`,
          path: dtPath,
          crumbs: [
            { name: "Accueil", url: "/" },
            { name: "Députés", url: "/deputes/" },
            { name: d.nom_complet, url: `/depute/${slug}/` },
            { name: tLib },
          ],
          h1: `${d.nom_complet} — votes sur ${tLib}`,
          sub: `${expressed} votes exprimés · 17ᵉ législature`,
          main: dtMain,
        }),
      );
      add(dtPath, "0.5");
      dtIndexed++;
    }
  }
  return { items, dtIndexed };
}

async function genThemes(grands) {
  const cats = await readJSON(join(dataDir, "categories.json"));
  for (const c of cats) {
    const path = `/theme/${c.id}/`;
    const scrutinsTheme = grands.filter((g) => g.categorie === c.id);
    const listHtml = scrutinsTheme.length
      ? `<h2>Grands scrutins sur ce thème</h2><div class="card"><ul class="links">${scrutinsTheme
          .slice(0, 40)
          .map((g) => `<li><a href="/scrutin/${g.numero}/">${esc(trunc(g.dossier_titre || g.titre, 80))}</a></li>`)
          .join("")}</ul></div>`
      : "";
    const title = `${c.libelle} — votes des députés à l'Assemblée | Scrutoir`;
    const description = `Les ${c.nb_scrutins} scrutins publics sur le thème « ${c.libelle} » à l'Assemblée nationale (17ᵉ législature).${c.derniere_date ? ` Dernier vote le ${fmtDate(c.derniere_date)}.` : ""}`;
    const main = `
      <div class="card"><div class="stats">
        <div class="stat"><b>${c.nb_scrutins}</b><span>scrutins publics classés</span></div>
        ${c.derniere_date ? `<div class="stat"><b>${fmtDate(c.derniere_date)}</b><span>dernier scrutin</span></div>` : ""}
      </div>
      ${c.dernier_titre ? `<p style="margin:14px 0 0">Dernier en date : <strong>${esc(c.dernier_titre)}</strong></p>` : ""}
      </div>
      <p>Retrouvez comment les députés et les groupes de la 17ᵉ législature ont voté sur les textes relevant du thème « ${esc(c.libelle)} ». Le classement par thème est calculé automatiquement à partir de l'intitulé des scrutins ; il est indicatif.</p>
      ${listHtml}
      <p><a href="/themes/">← Tous les thèmes</a></p>`;
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${c.libelle} — votes à l'Assemblée nationale`,
      description,
      url: SITE + path,
      isPartOf: { "@type": "WebSite", name: "Scrutoir", url: SITE },
    };
    await writePage(
      path,
      shell({
        title,
        description,
        path,
        jsonld,
        crumbs: [{ name: "Accueil", url: "/" }, { name: "Thèmes", url: "/themes/" }, { name: c.libelle }],
        h1: c.libelle,
        sub: `${c.nb_scrutins} scrutins publics · 17ᵉ législature`,
        main,
      }),
    );
    add(path, "0.6");
  }
  return cats;
}

async function genPartis() {
  const list = await readJSON(join(dataDir, "partis.json"));
  const items = [];
  for (const pr of list) {
    const slug = slugify(pr.abrev || pr.libelle);
    const path = `/parti/${slug}/`;
    items.push({ ...pr, slug });

    let detail = null;
    try {
      detail = (await readJSON(join(dataDir, "parti", `${pr.uid}.json`)))?.all || null;
    } catch {
      /* détail absent */
    }
    const cats = (detail?.categories || []).filter((c) => (c.pour || 0) + (c.contre || 0) + (c.abstention || 0) > 0);
    const catsTable = cats.length
      ? `<h2>Positions par thème</h2><div class="card"><table>
         <thead><tr><th>Thème</th><th class="n">Pour</th><th class="n">Contre</th><th class="n">Abst.</th></tr></thead>
         <tbody>${cats
           .map(
             (c) =>
               `<tr><td><a href="/theme/${esc(c.id)}/">${esc(c.libelle)}</a></td><td class="n">${c.pour}</td><td class="n">${c.contre}</td><td class="n">${c.abstention}</td></tr>`,
           )
           .join("")}</tbody></table></div>`
      : "";
    const statHtml = detail
      ? `<div class="card"><div class="stats">
          <div class="stat"><b>${pr.nb_deputes}</b><span>députés</span></div>
          ${detail.cohesion_pct != null ? `<div class="stat"><b>${detail.cohesion_pct}%</b><span>cohésion des votes</span></div>` : ""}
          ${detail.participation_moy_pct != null ? `<div class="stat"><b>${detail.participation_moy_pct}%</b><span>participation moyenne</span></div>` : ""}
        </div></div>`
      : `<div class="card"><div class="stats"><div class="stat"><b>${pr.nb_deputes}</b><span>députés</span></div></div></div>`;

    const title = `${pr.libelle} (${pr.abrev}) — votes du groupe à l'Assemblée | Scrutoir`;
    const description = `Le groupe ${pr.libelle} (${pr.abrev}) à l'Assemblée nationale : ${pr.nb_deputes} députés, cohésion, participation et positions par thème, à partir des scrutins publics nominatifs.`;
    const main = `
      <p>Le groupe <strong>${esc(pr.libelle)}</strong>${pr.abrev ? ` (${esc(pr.abrev)})` : ""} compte ${pr.nb_deputes} députés à la 17ᵉ législature.${detail?.president?.nom_complet ? ` Présidé par ${esc(detail.president.nom_complet)}.` : ""}</p>
      ${statHtml}
      ${catsTable}
      <p><a href="/partis/">← Tous les groupes</a></p>`;
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: pr.libelle,
      alternateName: pr.abrev,
      url: SITE + path,
      memberOf: { "@type": "Organization", name: "Assemblée nationale" },
    };
    await writePage(
      path,
      shell({
        title,
        description,
        path,
        jsonld,
        crumbs: [{ name: "Accueil", url: "/" }, { name: "Partis", url: "/partis/" }, { name: pr.abrev || pr.libelle }],
        h1: `${pr.libelle}${pr.abrev ? ` (${pr.abrev})` : ""}`,
        sub: `Groupe parlementaire · ${pr.nb_deputes} députés · 17ᵉ législature`,
        main,
      }),
    );
    add(path, "0.6");
  }
  return items;
}

async function genScrutins(scrutinsList) {
  let n = 0;
  for (const item of scrutinsList) {
    const path = `/scrutin/${item.numero}/`;
    let detail = null;
    try {
      detail = await readJSON(join(dataDir, "scrutin", `${item.uid}.json`));
    } catch {
      /* détail absent → on saute (rare) */
    }
    if (!detail?.scrutin) continue;
    const g = { ...detail.scrutin, categorie: item.categorie || null };
    const groupes = detail.groupes || [];
    const adopted = g.sort_code === "adopte";
    const titre = g.dossier_titre || g.titre;
    const groupTable = groupes.length
      ? `<h2>Vote par groupe</h2><div class="card"><table>
         <thead><tr><th>Groupe</th><th>Consigne</th><th class="n">Pour</th><th class="n">Contre</th><th class="n">Abst.</th></tr></thead>
         <tbody>${groupes
           .map(
             (gr) =>
               `<tr><td><a href="/parti/${slugify(gr.abrev || gr.libelle)}/">${esc(gr.abrev || gr.libelle)}</a></td><td>${esc(cap(gr.consigne || "—"))}</td><td class="n">${gr.pour}</td><td class="n">${gr.contre}</td><td class="n">${gr.abstention}</td></tr>`,
           )
           .join("")}</tbody></table></div>`
      : "";
    const title = `Vote : ${trunc(titre, 70)} — ${adopted ? "adopté" : "rejeté"} | Scrutoir`;
    const description = `Scrutin n°${g.numero} du ${fmtDate(g.date)} : ${g.sort_libelle}. ${g.pour} pour, ${g.contre} contre, ${g.abstention} abstention. Détail du vote par groupe à l'Assemblée nationale.`;
    const main = `
      <div class="card">
        <span class="badge" style="background:${adopted ? COL.pour : COL.contre}">${esc(cap(g.sort_libelle || (adopted ? "Adopté" : "Rejeté")))}</span>
        <p style="margin:12px 0 0;color:#5A626E;font-size:14px">Scrutin public n°${g.numero} · ${fmtDate(g.date)}${g.type_vote ? ` · ${esc(g.type_vote)}` : ""}${g.categorie ? ` · <a href="/theme/${esc(g.categorie)}/">thème</a>` : ""}</p>
        ${voteBar(g.pour, g.contre, g.abstention)}
        <p class="legend"><span><i style="background:${COL.pour}"></i>${g.pour} pour</span><span><i style="background:${COL.contre}"></i>${g.contre} contre</span><span><i style="background:${COL.abstention}"></i>${g.abstention} abstention</span></p>
      </div>
      ${g.objet && g.objet !== titre ? `<p>${esc(g.objet)}</p>` : ""}
      ${groupTable}
      <p><a href="https://www.assemblee-nationale.fr/dyn/17/scrutins/${g.numero}" rel="nofollow noopener">Voir le scrutin officiel sur le site de l'Assemblée nationale →</a></p>
      <p><a href="/scrutins/">← Tous les grands scrutins</a></p>`;
    const jsonld = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: trunc(titre, 110),
      datePublished: String(g.date).slice(0, 10),
      about: titre,
      isPartOf: { "@type": "WebSite", name: "Scrutoir", url: SITE },
      publisher: { "@type": "Organization", name: "Scrutoir" },
      url: SITE + path,
    };
    await writePage(
      path,
      shell({
        title,
        description,
        path,
        ogType: "article",
        jsonld,
        crumbs: [{ name: "Accueil", url: "/" }, { name: "Grands scrutins", url: "/scrutins/" }, { name: `Scrutin n°${g.numero}` }],
        h1: titre,
        sub: `Scrutin public n°${g.numero} · ${fmtDate(g.date)}`,
        main,
      }),
    );
    add(path, "0.5");
    if (++n % 2000 === 0) console.log(`[prerender-seo] … ${n} pages scrutin générées`);
  }
  return n;
}

// ---------- hubs (listes crawlables) ----------
async function genHubs(deputes, themes, partis, grands) {
  // Députés, groupés par parti
  const byGroup = {};
  deputes.forEach((d) => {
    (byGroup[d.groupe] ||= []).push(d);
  });
  const depBody =
    `<p>Les ${deputes.length} députés de la 17ᵉ législature. Cliquez pour voir comment chacun a voté, par thème.</p>` +
    Object.keys(byGroup)
      .sort((a, b) => byGroup[b].length - byGroup[a].length)
      .map(
        (grp) =>
          `<h2>${esc(grp)} (${byGroup[grp].length})</h2><div class="card"><ul class="links">${byGroup[grp]
            .sort((a, b) => a.nom_complet.localeCompare(b.nom_complet, "fr"))
            .map((d) => `<li><a href="/depute/${d.slug}/">${esc(d.nom_complet)}</a></li>`)
            .join("")}</ul></div>`,
      )
      .join("");
  await writePage(
    "/deputes/",
    shell({
      title: "Tous les députés et leurs votes — 17ᵉ législature | Scrutoir",
      description: `Les ${deputes.length} députés de l'Assemblée nationale (17ᵉ législature) : participation, votes par thème et dissidences, à partir des scrutins publics nominatifs.`,
      path: "/deputes/",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Tous les députés", url: SITE + "/deputes/" },
      crumbs: [{ name: "Accueil", url: "/" }, { name: "Députés" }],
      h1: "Tous les députés",
      sub: `${deputes.length} élus · 17ᵉ législature`,
      main: depBody,
    }),
  );
  add("/deputes/", "0.8", "daily");

  // Thèmes
  await writePage(
    "/themes/",
    shell({
      title: "Votes des députés par thème — Assemblée nationale | Scrutoir",
      description: "Parcourez les scrutins publics de l'Assemblée nationale par grand thème : écologie, sécurité, économie, santé, travail…",
      path: "/themes/",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Thèmes", url: SITE + "/themes/" },
      crumbs: [{ name: "Accueil", url: "/" }, { name: "Thèmes" }],
      h1: "Explorer par thème",
      sub: `${themes.length} grands thèmes`,
      main: `<div class="card"><ul class="links">${themes
        .map((c) => `<li><a href="/theme/${c.id}/">${esc(c.libelle)}</a> <span style="color:#9AA1AB">(${c.nb_scrutins})</span></li>`)
        .join("")}</ul></div>`,
    }),
  );
  add("/themes/", "0.8");

  // Partis
  await writePage(
    "/partis/",
    shell({
      title: "Les groupes parlementaires et leurs votes | Scrutoir",
      description: "Les groupes de la 17ᵉ législature : effectifs, cohésion, participation et positions par thème, à partir des scrutins publics nominatifs.",
      path: "/partis/",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Partis", url: SITE + "/partis/" },
      crumbs: [{ name: "Accueil", url: "/" }, { name: "Partis" }],
      h1: "Les groupes parlementaires",
      sub: `${partis.length} groupes · 17ᵉ législature`,
      main: `<div class="card"><ul class="links">${partis
        .map((p) => `<li><a href="/parti/${p.slug}/">${esc(p.libelle)} (${esc(p.abrev)})</a> <span style="color:#9AA1AB">(${p.nb_deputes})</span></li>`)
        .join("")}</ul></div>`,
    }),
  );
  add("/partis/", "0.7");

  // Grands scrutins
  await writePage(
    "/scrutins/",
    shell({
      title: "Les grands scrutins de l'Assemblée nationale | Scrutoir",
      description: "Les votes solennels marquants de la 17ᵉ législature : résultat, détail par groupe et consigne, à partir des scrutins publics nominatifs.",
      path: "/scrutins/",
      jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "Grands scrutins", url: SITE + "/scrutins/" },
      crumbs: [{ name: "Accueil", url: "/" }, { name: "Grands scrutins" }],
      h1: "Les grands scrutins",
      sub: `${grands.length} votes marquants`,
      main: `<div class="card"><ul class="links">${grands
        .map((g) => `<li><a href="/scrutin/${g.numero}/">${esc(trunc(g.dossier_titre || g.titre, 70))}</a></li>`)
        .join("")}</ul></div>`,
    }),
  );
  add("/scrutins/", "0.7", "daily");
}

async function writeSitemap() {
  let lastmod = "";
  try {
    const v = await readJSON(join(dataDir, "version.json"));
    if (typeof v?.generatedAt === "string") lastmod = v.generatedAt.slice(0, 10);
  } catch {
    /* pas de lastmod */
  }
  const all = [{ path: "/", priority: "1.0", changefreq: "daily" }, ...urls];
  const body = all
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE}${u.path}</loc>` +
        (lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "") +
        `\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  await writeFile(join(distDir, "sitemap.xml"), xml, "utf8");
  return all.length;
}

async function main() {
  try {
    await readJSON(join(dataDir, "deputes.json"));
  } catch {
    console.error(`[prerender-seo] dist/data introuvable — lance d'abord \`expo export -p web\`.`);
    process.exit(1);
  }
  const grands = await readJSON(join(dataDir, "grands.json"));
  const scrutinsList = await readJSON(join(dataDir, "scrutins.json"));

  // Carte scrutin → { numero, titre, date, thème } : sert au lot 6 (ranger les votes par thème).
  const scrutinMap = {};
  for (const s of scrutinsList) scrutinMap[s.uid] = { numero: s.numero, titre: s.titre, date: s.date, cat: s.categorie || null };
  // Libellés des thèmes (id → libellé) pour les pages député×thème.
  const themesMeta = {};
  for (const c of await readJSON(join(dataDir, "categories.json"))) themesMeta[c.id] = { libelle: c.libelle };

  const { items: deputes, dtIndexed } = await genDeputes(scrutinMap, themesMeta);
  const themes = await genThemes(grands);
  const partis = await genPartis();
  const nbScrutins = await genScrutins(scrutinsList);
  await genHubs(deputes, themes, partis, grands);
  const n = await writeSitemap();
  console.log(
    `[prerender-seo] ${deputes.length} députés, ${themes.length} thèmes, ${partis.length} partis, ${nbScrutins} scrutins, ` +
      `${dtIndexed} pages député×thème (top ${DEPUTE_THEME_MAX}/député) + 4 hubs → ${n} URLs au sitemap.`,
  );

  // Garde-fou : Cloudflare Pages refuse > 20 000 fichiers PAR projet. Le déploiement est
  // séparé en deux projets (split-data-site.mjs) : `scrutoir` = dist HORS /data (app +
  // pages SEO), `scrutoir-data` = /data. On compte chaque projet et on échoue tôt, avec
  // un message clair, plutôt que de laisser `wrangler pages deploy` planter en fin de CI.
  const compter = async (dir) => {
    let n = 0;
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n += await compter(join(dir, e.name));
      else n++;
    }
    return n;
  };
  const nData = await compter(dataDir);
  const nApp = (await compter(distDir)) - nData;
  console.log(
    `[prerender-seo] projet app (dist hors /data) : ${nApp} fichiers ; projet data : ${nData} ` +
      `(limite Cloudflare Pages : ${CF_PAGES_FILE_LIMIT} PAR projet).`,
  );
  if (nApp > CF_PAGES_FILE_LIMIT || nData > CF_PAGES_FILE_LIMIT) {
    console.error(
      `[prerender-seo] ERREUR : ${Math.max(nApp, nData)} > ${CF_PAGES_FILE_LIMIT} fichiers sur un projet — ` +
        `réduire DEPUTE_THEME_MAX (app) ou regrouper les JSON scrutins en paquets (data).`,
    );
    process.exit(1);
  }
}

main();
