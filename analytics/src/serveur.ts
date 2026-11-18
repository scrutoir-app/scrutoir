/**
 * Routes du Worker : POST /collect (mesure), GET /stats (tableau de bord privé), polices du
 * tableau de bord. La source des données est injectée : SQL Analytics Engine en production
 * (index.ts), données fictives en local (demo.ts, `wrangler dev src/demo.ts`).
 */

import { traiterCollecte, corsHeaders, type Ecrivain } from "./collecte";
import { rendreTableau, type Donnees, type Jalon } from "./tableau";
// Manrope (SIL OFL 1.1, cf. polices/OFL.txt), la police de l'appli, servie par le Worker lui-même :
// aucune ressource tierce, la CSP n'autorise les polices que depuis cette origine.
import manrope500 from "../polices/manrope-500.ttf";
import manrope800 from "../polices/manrope-800.ttf";

export interface EnvServeur {
  AE: Ecrivain;
  ALLOWED_ORIGINS: string;
  DASH_KEY: string;
}

// Comparaison à temps constant (auth dashboard) : évite une fuite par timing du mot de passe.
function safeEqual(a: string, b: string): boolean {
  const e = new TextEncoder(), x = e.encode(a), y = e.encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const POLICES: Record<string, ArrayBuffer> = {
  "/stats/polices/manrope-500.ttf": manrope500,
  "/stats/polices/manrope-800.ttf": manrope800,
};

export async function servir(
  request: Request,
  env: EnvServeur,
  lire: (jours: number) => Promise<Donnees>,
  jalons: Jalon[],
): Promise<Response> {
  const url = new URL(request.url);
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin"), allowed) });
  }

  if (url.pathname === "/collect" && request.method === "POST") {
    return traiterCollecte(request, env.AE, allowed);
  }

  const police = POLICES[url.pathname];
  if (police && request.method === "GET") {
    return new Response(police, {
      headers: {
        "Content-Type": "font/ttf",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (url.pathname === "/stats" && request.method === "GET") {
    // Auth HTTP Basic : le navigateur demande le mot de passe (= DASH_KEY) ; rien
    // dans l'URL (pas de fuite via historique/referer). Le nom d'utilisateur est ignoré.
    const auth = request.headers.get("Authorization") || "";
    let pass = "";
    if (auth.startsWith("Basic ")) {
      try { pass = atob(auth.slice(6)).split(":").slice(1).join(":"); } catch { /* ignore */ }
    }
    if (!env.DASH_KEY || !safeEqual(pass, env.DASH_KEY)) {
      return new Response("Authentification requise.", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Scrutoir Analytics", charset="UTF-8"' },
      });
    }
    const jours = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
    const html = rendreTableau(await lire(jours), jalons);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Le tableau de bord n'a AUCUN <script> : CSS, SVG et HTML seuls (onglets en radio +
        // :checked). La CSP rend inerte toute injection résiduelle (défense en profondeur) ;
        // seule ouverture : les polices servies par ce même Worker.
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response("scrutoir-analytics ok", { status: 200 });
}
