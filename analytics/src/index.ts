/**
 * scrutoir-analytics — analytics « maison », privacy-first.
 *
 * - POST /collect : reçoit un événement anonyme et l'écrit dans Cloudflare Analytics
 *   Engine. AUCUN cookie, AUCUNE IP stockée, AUCUN identifiant utilisateur → RGPD clean,
 *   pas de bandeau. On ne stocke QUE : type d'événement + entité (uid/écran) + extra.
 * - GET /stats?key=… : tableau de bord privé (mot de passe) qui interroge Analytics
 *   Engine (SQL API) et affiche les classements (pages, députés, scrutins, duels, suivis…).
 *
 * Secrets (wrangler secret put) : CF_API_TOKEN (Account Analytics:Read), DASH_KEY (mdp).
 * Vars (wrangler.toml) : CF_ACCOUNT_ID, DATASET, ALLOWED_ORIGINS.
 */

interface Env {
  AE: AnalyticsEngineDataset;
  CF_ACCOUNT_ID: string;
  DATASET: string;
  ALLOWED_ORIGINS: string;
  CF_API_TOKEN: string;
  DASH_KEY: string;
}

// Types d'événements acceptés (tout le reste est ignoré).
const EVENTS = new Set([
  "screen", "depute", "scrutin", "parti", "theme",
  "confront", "follow", "unfollow", "search", "search_empty", "source", "install",
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

    // --- Réception d'un événement ---
    if (url.pathname === "/collect" && request.method === "POST") {
      const cors = corsHeaders(origin, allowed);
      try {
        const raw = await request.text();
        const ev = JSON.parse(raw || "{}");
        const type = clip(ev.t, 24);
        if (!EVENTS.has(type)) return new Response(null, { status: 204, headers: cors });
        const entity = clip(ev.e, 80);
        const extra = clip(ev.x, 40);
        env.AE.writeDataPoint({
          indexes: [type],          // 1 index (regroupement/échantillonnage)
          blobs: [type, entity, extra],
          doubles: [1],
        });
      } catch {
        /* corps invalide → on ignore silencieusement */
      }
      return new Response(null, { status: 204, headers: cors });
    }

    // --- Tableau de bord privé ---
    if (url.pathname === "/stats" && request.method === "GET") {
      if (!env.DASH_KEY || url.searchParams.get("key") !== env.DASH_KEY) {
        return new Response("Accès refusé.", { status: 401 });
      }
      const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
      try {
        const html = await dashboard(env, days);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      } catch (e) {
        return new Response("Erreur dashboard : " + (e as Error).message, { status: 500 });
      }
    }

    return new Response("scrutoir-analytics ok", { status: 200 });
  },
};

// --- Requêtes Analytics Engine (SQL API) ---
async function query(env: Env, sql: string): Promise<any[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: sql }
  );
  if (!res.ok) throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: any[] };
  return json.data || [];
}

// Top entités pour un type d'événement donné.
function topSql(dataset: string, type: string, days: number, limit = 20): string {
  return `SELECT blob2 AS k, sum(_sample_interval) AS n FROM ${dataset}
          WHERE blob1 = '${type}' AND timestamp > NOW() - INTERVAL '${days}' DAY
          GROUP BY k ORDER BY n DESC LIMIT ${limit}`;
}

async function fetchJson(u: string): Promise<any> {
  try { const r = await fetch(u, { cf: { cacheTtl: 3600 } as any }); return r.ok ? await r.json() : null; }
  catch { return null; }
}

async function dashboard(env: Env, days: number): Promise<string> {
  const ds = env.DATASET;
  // Référentiels pour afficher des noms lisibles (pas seulement des uid).
  const [deps, scrs, cats] = await Promise.all([
    fetchJson("https://scrutoir.fr/data/deputes.json"),
    fetchJson("https://scrutoir.fr/data/scrutins.json"),
    fetchJson("https://scrutoir.fr/data/categories.json"),
  ]);
  const depName = new Map<string, string>((deps || []).map((d: any) => [d.uid, d.nom_complet]));
  const scrTitre = new Map<string, string>((scrs || []).map((s: any) => [s.uid, s.titre]));
  const catName = new Map<string, string>((cats || []).map((c: any) => [c.id, c.libelle]));

  // Lancement des requêtes en parallèle.
  const [byType, screens, deputes, scrutins, confronts, follows, unfollows, themes, searches] = await Promise.all([
    query(env, `SELECT blob1 AS k, sum(_sample_interval) AS n FROM ${ds} WHERE timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY k ORDER BY n DESC`),
    query(env, topSql(ds, "screen", days)),
    query(env, topSql(ds, "depute", days)),
    query(env, topSql(ds, "scrutin", days)),
    query(env, topSql(ds, "confront", days)),
    query(env, topSql(ds, "follow", days, 50)),
    query(env, topSql(ds, "unfollow", days, 50)),
    query(env, topSql(ds, "theme", days)),
    query(env, topSql(ds, "search", days)),
  ]);

  // Suivis nets = follow − unfollow par député.
  const net = new Map<string, number>();
  for (const r of follows) net.set(r.k, (net.get(r.k) || 0) + Number(r.n));
  for (const r of unfollows) net.set(r.k, (net.get(r.k) || 0) - Number(r.n));
  const followsNet = [...net.entries()].map(([k, n]) => ({ k, n })).filter((r) => r.n > 0).sort((a, b) => b.n - a.n).slice(0, 20);

  const total = byType.reduce((s, r) => s + Number(r.n), 0);
  const esc = (s: string) => (s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

  const rows = (arr: any[], label: (k: string) => string) =>
    arr.length
      ? arr.map((r) => `<tr><td>${esc(label(r.k))}</td><td class="n">${Number(r.n).toLocaleString("fr-FR")}</td></tr>`).join("")
      : `<tr><td colspan="2" class="empty">—</td></tr>`;

  const duelLabel = (k: string) => {
    const [a, b] = k.split("|");
    return `${depName.get(a) || a} ✕ ${depName.get(b) || b}`;
  };

  const section = (titre: string, arr: any[], label: (k: string) => string) => `
    <section>
      <h2>${titre}</h2>
      <table><tbody>${rows(arr, label)}</tbody></table>
    </section>`;

  const typeLabels: Record<string, string> = {
    screen: "Écrans", depute: "Fiches député", scrutin: "Fiches scrutin", parti: "Fiches parti",
    theme: "Thèmes", confront: "Confrontations", follow: "Suivis ajoutés", unfollow: "Suivis retirés",
    search: "Recherches", search_empty: "Recherches sans résultat", source: "Clics source AN", install: "Installations app",
  };

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1"><title>Scrutoir · Analytics</title>
  <style>
    :root{--ink:#171A1F;--muted:#6B727E;--bg:#F2F4F7;--card:#fff;--accent:#3C4654;--line:#EAEDF1}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:20px;max-width:780px;margin:0 auto}
    h1{font-size:22px;margin:0 0 2px} .sub{color:var(--muted);font-size:13px;margin-bottom:18px}
    .periods a{display:inline-block;margin-right:8px;font-size:13px;color:var(--accent);text-decoration:none;padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:#fff}
    .kpis{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}
    .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px;min-width:120px}
    .kpi .v{font-size:20px;font-weight:700} .kpi .l{font-size:11.5px;color:var(--muted)}
    section{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}
    h2{font-size:14px;margin:0 0 8px} table{width:100%;border-collapse:collapse;font-size:13.5px}
    td{padding:6px 0;border-bottom:1px solid var(--line)} tr:last-child td{border-bottom:0}
    td.n{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);width:90px}
    td.empty{color:var(--muted);text-align:center}
  </style></head><body>
    <h1>Scrutoir · Analytics</h1>
    <div class="sub">Données anonymes, ${days} derniers jours · ${total.toLocaleString("fr-FR")} événements</div>
    <div class="periods">Période :
      <a href="?key=${esc(env.DASH_KEY)}&days=7">7 j</a>
      <a href="?key=${esc(env.DASH_KEY)}&days=30">30 j</a>
      <a href="?key=${esc(env.DASH_KEY)}&days=90">90 j</a>
    </div>
    <div class="kpis">
      ${byType.map((r) => `<div class="kpi"><div class="v">${Number(r.n).toLocaleString("fr-FR")}</div><div class="l">${typeLabels[r.k] || r.k}</div></div>`).join("")}
    </div>
    ${section("🔥 Duels les plus regardés", confronts, duelLabel)}
    ${section("⭐ Députés les plus suivis (net)", followsNet, (k) => depName.get(k) || k)}
    ${section("👤 Députés les plus consultés", deputes, (k) => depName.get(k) || k)}
    ${section("🗳️ Scrutins les plus consultés", scrutins, (k) => scrTitre.get(k) || k)}
    ${section("🧭 Écrans les plus vus", screens, (k) => k)}
    ${section("📚 Thèmes les plus explorés", themes, (k) => catName.get(k) || k)}
    ${section("🔎 Recherches les plus fréquentes", searches, (k) => k)}
  </body></html>`;
}
