/**
 * scrutoir-analytics — analytics « maison », privacy-first.
 *
 * - POST /collect : reçoit un événement anonyme → Cloudflare Analytics Engine.
 *   AUCUN cookie, AUCUNE IP stockée, AUCUN identifiant. On ne stocke que :
 *   type d'événement + entité (uid/écran) + extra.
 * - GET /stats?key=… : tableau de bord privé (mot de passe).
 *
 * AUTO-ÉVOLUTIF : le dashboard lit les données en direct et s'adapte tout seul.
 * Tout NOUVEL événement envoyé via track("<type>", …) apparaît automatiquement
 * (carte KPI + section classement générique). Pour un libellé/icône joli ou une
 * résolution de noms, ajouter une entrée dans META / NAMED ci-dessous.
 *
 * Secrets (wrangler secret put) : CF_API_TOKEN (Account Analytics:Read), DASH_KEY (mdp).
 */

interface Env {
  AE: AnalyticsEngineDataset;
  CF_ACCOUNT_ID: string;
  DATASET: string;
  ALLOWED_ORIGINS: string;
  CF_API_TOKEN: string;
  DASH_KEY: string;
}

const EVENTS = new Set([
  "screen", "depute", "scrutin", "parti", "theme",
  "confront", "follow", "unfollow", "follow_parti", "unfollow_parti",
  "search", "search_empty", "source", "install",
]);

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const ok = origin && allowed.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": ok || "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const clip = (s: unknown, n: number): string => (typeof s === "string" ? s : "").slice(0, n);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    if (url.pathname === "/collect" && request.method === "POST") {
      const cors = corsHeaders(origin, allowed);
      // Anti-spam : on n'enregistre que les événements émis depuis NOS origines
      // (notre app). Bloque le spam d'autres sites / scripts. Réponse 204 dans tous
      // les cas (on ne révèle rien). L'Origin reste falsifiable hors navigateur, mais
      // ça élève la barre sans infra.
      const fromUs = !!origin && allowed.includes(origin);
      if (fromUs) {
        try {
          const ev = JSON.parse((await request.text()) || "{}");
          const type = clip(ev.t, 24);
          if (EVENTS.has(type)) {
            // blob4 = catégorie d'appareil (mobile/tablet/desktop), dérivée du viewport
            // côté app. Agrégé/anonyme ; vide pour les anciens événements.
            env.AE.writeDataPoint({
              indexes: [type],
              blobs: [type, clip(ev.e, 80), clip(ev.x, 40), clip(ev.d, 12)],
              doubles: [1],
            });
          }
        } catch {
          /* corps invalide → ignoré */
        }
      }
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      // Auth HTTP Basic : le navigateur demande le mot de passe (= DASH_KEY) ; rien
      // dans l'URL (pas de fuite via historique/referer). Le nom d'utilisateur est ignoré.
      const auth = request.headers.get("Authorization") || "";
      let pass = "";
      if (auth.startsWith("Basic ")) {
        try { pass = atob(auth.slice(6)).split(":").slice(1).join(":"); } catch { /* ignore */ }
      }
      if (!env.DASH_KEY || pass !== env.DASH_KEY) {
        return new Response("Authentification requise.", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Scrutoir Analytics", charset="UTF-8"' },
        });
      }
      const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
      const html = await dashboard(env, days);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("scrutoir-analytics ok", { status: 200 });
  },
};

// --- Analytics Engine (SQL API), résilient : [] en cas d'erreur (ne casse pas la page) ---
async function q(env: Env, sql: string): Promise<any[]> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
      { method: "POST", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: sql }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: any[] };
    return json.data || [];
  } catch {
    return [];
  }
}

const topSql = (ds: string, type: string, days: number, limit = 15) =>
  `SELECT blob2 AS k, sum(_sample_interval) AS n FROM ${ds}
   WHERE blob1 = '${type}' AND timestamp > NOW() - INTERVAL '${days}' DAY
   GROUP BY k ORDER BY n DESC LIMIT ${limit}`;

async function fetchJson(u: string): Promise<any> {
  try { const r = await fetch(u, { cf: { cacheTtl: 3600 } as any }); return r.ok ? await r.json() : null; }
  catch { return null; }
}

// Icône + libellé par type d'événement (les types inconnus tombent sur un générique).
const META: Record<string, { i: string; l: string }> = {
  screen: { i: "🧭", l: "Écrans vus" },
  depute: { i: "👤", l: "Fiches député" },
  scrutin: { i: "🗳️", l: "Fiches scrutin" },
  parti: { i: "🏛️", l: "Fiches parti" },
  theme: { i: "📚", l: "Thèmes" },
  confront: { i: "🔥", l: "Duels" },
  follow: { i: "⭐", l: "Suivis député +" },
  unfollow: { i: "➖", l: "Suivis député −" },
  follow_parti: { i: "🏳️", l: "Suivis parti +" },
  unfollow_parti: { i: "➖", l: "Suivis parti −" },
  search: { i: "🔎", l: "Recherches" },
  search_empty: { i: "🔍", l: "Recherches vides" },
  source: { i: "🔗", l: "Clics source AN" },
  install: { i: "📲", l: "Installations" },
};
const meta = (t: string) => META[t] || { i: "•", l: t };

async function dashboard(env: Env, days: number): Promise<string> {
  const ds = env.DATASET;
  const esc = (s: string) => (s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

  const [deps, scrs, cats, prts] = await Promise.all([
    fetchJson("https://scrutoir.fr/data/deputes.json"),
    fetchJson("https://scrutoir.fr/data/scrutins.json"),
    fetchJson("https://scrutoir.fr/data/categories.json"),
    fetchJson("https://scrutoir.fr/data/partis.json"),
  ]);
  const depName = new Map<string, string>((deps || []).map((d: any) => [d.uid, d.nom_complet]));
  const scrTitre = new Map<string, string>((scrs || []).map((s: any) => [s.uid, s.titre]));
  const catName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.libelle]));
  const partiName = new Map<string, string>((prts || []).map((p: any) => [p.uid, p.abrev || p.libelle]));

  const byType = await q(env, `SELECT blob1 AS k, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY k ORDER BY n DESC`);
  const total = byType.reduce((s, r) => s + Number(r.n), 0);

  const activity = await q(env, `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS d, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY d ORDER BY d`);

  // Répartition par type d'appareil (blob4 = mobile/tablet/desktop ; vide = anciens événements).
  const devices = await q(env, `SELECT blob4 AS k, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${days}' DAY AND blob4 != '' GROUP BY k ORDER BY n DESC`);
  const deviceLabel = (k: string) => ({ mobile: "📱 Mobile", tablet: "💻 Tablette", desktop: "🖥️ Desktop" }[k] || k);

  // Sections « jolies » (résolution de noms). Tout le reste devient générique.
  const [confronts, follows, unfollows, deputes, scrutins, screens, themes, searches, partisVus, folP, unfP] = await Promise.all([
    q(env, topSql(ds, "confront", days)),
    q(env, topSql(ds, "follow", days, 60)),
    q(env, topSql(ds, "unfollow", days, 60)),
    q(env, topSql(ds, "depute", days)),
    q(env, topSql(ds, "scrutin", days)),
    q(env, topSql(ds, "screen", days)),
    q(env, topSql(ds, "theme", days)),
    q(env, topSql(ds, "search", days)),
    q(env, topSql(ds, "parti", days)),
    q(env, topSql(ds, "follow_parti", days, 60)),
    q(env, topSql(ds, "unfollow_parti", days, 60)),
  ]);

  const netOf = (fol: any[], unf: any[]) => {
    const m = new Map<string, number>();
    for (const r of fol) m.set(r.k, (m.get(r.k) || 0) + Number(r.n));
    for (const r of unf) m.set(r.k, (m.get(r.k) || 0) - Number(r.n));
    return [...m.entries()].map(([k, n]) => ({ k, n })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 15);
  };
  const followsNet = netOf(follows, unfollows);
  const partisNet = netOf(folP, unfP);

  const duelLabel = (k: string) => { const [a, b] = k.split("|"); return `${depName.get(a) || a}  ✕  ${depName.get(b) || b}`; };

  // Auto-sections : tout type d'événement présent et NON déjà couvert ci-dessus.
  const covered = new Set(["confront", "follow", "unfollow", "follow_parti", "unfollow_parti", "depute", "parti", "scrutin", "screen", "theme", "search", "search_empty", "source", "install"]);
  const extraTypes = byType.map((r) => r.k).filter((t: string) => !covered.has(t));
  const extras = await Promise.all(extraTypes.map((t: string) => q(env, topSql(ds, t, days)).then((rows) => ({ t, rows }))));

  // --- Rendu ---
  const bars = (arr: any[], label: (k: string) => string) => {
    if (!arr.length) return `<div class="empty">Aucune donnée sur la période</div>`;
    const max = Math.max(...arr.map((r) => Number(r.n)));
    return arr.map((r) => {
      const n = Number(r.n);
      const w = Math.max(4, Math.round((n / max) * 100));
      return `<div class="row"><div class="lbl" title="${esc(label(r.k))}">${esc(label(r.k))}</div><div class="track"><span style="width:${w}%"></span></div><div class="val">${n.toLocaleString("fr-FR")}</div></div>`;
    }).join("");
  };
  const card = (title: string, arr: any[], label: (k: string) => string) =>
    `<section><h2>${title}</h2>${bars(arr, label)}</section>`;

  // Courbe d'activité (CSS), masquée si la requête n'est pas dispo.
  let chart = "";
  if (activity.length) {
    const max = Math.max(...activity.map((r) => Number(r.n)));
    const cols = activity.map((r) => {
      const h = Math.max(3, Math.round((Number(r.n) / max) * 100));
      const day = String(r.d || "").slice(8, 10);
      return `<div class="col"><div class="cbar" style="height:${h}%" title="${esc(String(r.d))} : ${Number(r.n)}"></div><div class="cd">${day}</div></div>`;
    }).join("");
    chart = `<section><h2>📈 Activité (${activity.length} jours)</h2><div class="chart">${cols}</div></section>`;
  }

  const kpis = byType.map((r) => {
    const m = meta(r.k);
    return `<div class="kpi"><div class="i">${m.i}</div><div class="v">${Number(r.n).toLocaleString("fr-FR")}</div><div class="l">${m.l}</div></div>`;
  }).join("") || `<div class="empty">Aucun événement encore. Reviens après quelques visites de l'app 🙂</div>`;

  const period = (d: number, lbl: string) =>
    `<a class="${d === days ? "on" : ""}" href="?days=${d}">${lbl}</a>`;

  // Logo Scrutoir (hémicycle) en blanc.
  const logo = `<svg viewBox="0 0 200 144" width="34" height="24" aria-hidden="true">${
    [[188,120.96],[182.69,90.86],[167.41,64.39],[144,44.75],[115.28,34.3],[84.72,34.3],[56,44.75],[32.59,64.39],[17.31,90.86],[12,120.96],[162,120.96],[155.86,94.06],[138.66,72.49],[113.8,60.51],[86.2,60.51],[61.34,72.49],[44.14,94.06],[38,120.96]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9.2" fill="#fff"/>`).join("") +
    `<circle cx="100" cy="120.96" r="20" fill="#fff" opacity="0.85"/>`
  }</svg>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"><title>Scrutoir · Analytics</title>
  <style>
    :root{--ink:#171A1F;--muted:#6B727E;--faint:#A0A6B0;--bg:#F2F4F7;--card:#fff;--accent:#3C4654;--line:#EAEDF1}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,sans-serif;-webkit-font-smoothing:antialiased}
    .wrap{max-width:860px;margin:0 auto;padding:0 16px 48px}
    header{background:linear-gradient(135deg,#171A1F,#3C4654);color:#fff;border-radius:0 0 22px 22px;padding:22px 22px 24px;margin:0 -16px 18px;box-shadow:0 10px 30px rgba(23,26,31,.12)}
    .brand{display:flex;align-items:center;gap:10px}
    .brand h1{font-size:18px;margin:0;font-weight:800;letter-spacing:-.3px}
    .brand .tag{margin-left:auto;font-size:11px;background:rgba(255,255,255,.16);padding:3px 9px;border-radius:999px}
    .hl{font-size:30px;font-weight:800;margin:14px 0 0;letter-spacing:-.5px}
    .hl small{font-size:13px;font-weight:500;opacity:.8;letter-spacing:0}
    .periods{margin-top:14px;display:flex;gap:7px}
    .periods a{font-size:12.5px;color:#fff;text-decoration:none;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.14)}
    .periods a.on{background:#fff;color:var(--accent);font-weight:700}
    .kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px;margin-bottom:16px}
    .kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 13px}
    .kpi .i{font-size:16px} .kpi .v{font-size:21px;font-weight:800;letter-spacing:-.4px;margin-top:2px} .kpi .l{font-size:11px;color:var(--muted);margin-top:1px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}
    section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:15px 17px}
    h2{font-size:14px;margin:0 0 12px;letter-spacing:-.2px}
    .row{display:flex;align-items:center;gap:10px;margin:7px 0}
    .lbl{flex:0 0 42%;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .track{flex:1;height:8px;background:#EEF0F3;border-radius:999px;overflow:hidden}
    .track span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#3C4654,#5B6675)}
    .val{flex:0 0 auto;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:42px;text-align:right}
    .empty{color:var(--faint);font-size:12.5px;padding:6px 0}
    .chart{display:flex;align-items:flex-end;gap:3px;height:90px}
    .chart .col{flex:1;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;gap:4px}
    .chart .cbar{width:100%;max-width:18px;background:linear-gradient(180deg,#5B6675,#3C4654);border-radius:4px 4px 0 0;min-height:3px}
    .chart .cd{font-size:9px;color:var(--faint)}
    footer{color:var(--faint);font-size:11.5px;text-align:center;margin-top:22px;line-height:1.5}
  </style></head><body><div class="wrap">
    <header>
      <div class="brand">${logo}<h1>Scrutoir · Analytics</h1><span class="tag">privé</span></div>
      <div class="hl">${total.toLocaleString("fr-FR")} <small>événements · ${days} derniers jours</small></div>
      <div class="periods">${period(7, "7 jours")}${period(30, "30 jours")}${period(90, "90 jours")}</div>
    </header>

    <div class="kpis">${kpis}</div>
    ${chart}

    <div class="grid" style="margin-top:14px">
      ${card("📱 Répartition par appareil", devices, deviceLabel)}
      ${card("🔥 Duels les plus regardés", confronts, duelLabel)}
      ${card("⭐ Députés les plus suivis", followsNet, (k) => depName.get(k) || k)}
      ${card("🏳️ Partis les plus suivis", partisNet, (k) => partiName.get(k) || k)}
      ${card("👤 Députés les plus consultés", deputes, (k) => depName.get(k) || k)}
      ${card("🏛️ Partis les plus consultés", partisVus, (k) => partiName.get(k) || k)}
      ${card("🗳️ Scrutins les plus consultés", scrutins, (k) => scrTitre.get(k) || k)}
      ${card("📚 Thèmes les plus explorés", themes, (k) => catName.get(k) || k)}
      ${card("🔎 Recherches les plus fréquentes", searches, (k) => k)}
      ${card("🧭 Écrans les plus vus", screens, (k) => k)}
      ${extras.map((e) => card(`${meta(e.t).i} ${meta(e.t).l}`, e.rows, (k) => k)).join("")}
    </div>

    <footer>Données 100 % anonymes — sans cookie, sans IP, sans identité.<br>Mises à jour en direct à chaque chargement.</footer>
  </div></body></html>`;
}
