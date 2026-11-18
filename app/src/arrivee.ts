/**
 * Provenance des visites : un événement `arrivee` par visite, `track("arrivee", entree, source)`.
 *
 * Tout est déduit sur l'appareil puis ramené à une valeur des listes fermées de
 * `mesureListes.ts` : l'écran d'arrivée (accueil, test, scrutin…) et la provenance (lien
 * partagé, Instagram, moteur, appli installée, accès direct). Du référent, seul le NOM DE
 * DOMAINE est lu, et seule sa catégorie part. Rien sur le contenu d'un lien partagé : un
 * `#test=` dit « arrivée sur un résultat partagé », jamais ce que contient ce résultat.
 *
 * Appelé une fois, au démarrage de l'appli web (index.ts), avant le premier rendu : il règle
 * aussi `?mesure=on|off` (avant tout envoi) et retire `via`, `source` et `mesure` de la barre
 * d'adresse. `open` et le hash `#test=` restent : App.tsx les lit ensuite.
 */

import { reglerMesure, track } from "./analytics";
import { SOURCES_INSTAGRAM, type Entree, type Referent, type Source } from "./mesureListes";
import { TYPES_LIEN } from "./presidentielle/logique";

/** Garde « une seule arrivée par visite » (sessionStorage : reste sur l'appareil, oublié à la fermeture de l'onglet). */
export const CLE_ARRIVEE = "scrutoir.arrivee";

/** Paramètres lus puis retirés de l'adresse. */
export const PARAMS_RETIRES = ["via", "source", "mesure"] as const;

const aLienTest = (hash: string) => /(^#|&)test=/.test(hash);

/**
 * Catégorie d'un référent (`document.referrer`), par son seul nom de domaine. `null` = pas de
 * référent exploitable (vide, illisible, ou l'appli elle-même) : la visite sera « directe ».
 */
export function categorieReferent(referrer: string | null | undefined, hoteSite?: string): Referent | null {
  if (!referrer) return null;
  let u: URL;
  try {
    u = new URL(referrer);
  } catch {
    return null;
  }
  const h = u.hostname.toLowerCase();
  if (!h) return null;
  const est = (d: string) => h === d || h.endsWith(`.${d}`);
  // Nos pages : une page statique (SEO) mène à l'appli ; l'appli elle-même (« / ») n'est pas une provenance.
  if (est("scrutoir.fr") || est("scrutoir.pages.dev") || (!!hoteSite && h === hoteSite.toLowerCase())) {
    return u.pathname && u.pathname !== "/" ? "pages_seo" : null;
  }
  if (est("instagram.com")) return "instagram";
  if (est("facebook.com") || est("fb.com") || est("fb.me")) return "facebook";
  if (est("threads.net") || est("threads.com")) return "threads";
  if (est("x.com") || est("twitter.com") || est("t.co")) return "x";
  if (est("linkedin.com") || est("lnkd.in")) return "linkedin";
  if (/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h) || h === "com.google.android.googlequicksearchbox") return "google";
  if (est("bing.com")) return "bing";
  return "autre_site";
}

/** Provenance d'une visite : première règle qui s'applique (cf. mesureListes.ts, SOURCES). */
export function choisirSource(p: { hash: string; params: URLSearchParams; referrer?: string | null; hoteSite?: string }): Source {
  if (aLienTest(p.hash) || p.params.get("via") === "partage") return "partage";
  const brut = p.params.get("source");
  if (brut !== null) {
    const s = brut.trim().toLowerCase();
    if ((SOURCES_INSTAGRAM as readonly string[]).includes(s)) return s as Source;
    if (s === "pwa") return "pwa";
    return "autre_lien"; // valeur inconnue : jamais transmise telle quelle
  }
  return categorieReferent(p.referrer, p.hoteSite) ?? "direct";
}

/** Écran d'arrivée, d'après le hash `#test=` et le lien profond `?open=type:id` (cf. App.tsx). */
export function choisirEntree(hash: string, params: URLSearchParams): Entree {
  if (aLienTest(hash)) return "test";
  const open = params.get("open");
  if (!open) return "accueil";
  const [type, id] = open.split(":");
  if ((TYPES_LIEN as readonly string[]).includes(type)) return "presidentielle";
  if (!id) return "accueil"; // `?open=depute` sans identifiant : App.tsx reste sur l'accueil
  if (type === "scrutin" || type === "depute" || type === "parti") return type;
  return "autre";
}

/**
 * La query string sans les paramètres `noms`, encodage d'origine conservé (`open=depute:PA1`
 * reste tel quel). `null` si rien à retirer.
 */
export function rechercheSans(search: string, noms: readonly string[]): string | null {
  const morceaux = search.replace(/^\?/, "").split("&").filter(Boolean);
  const gardes = morceaux.filter((m) => {
    let cle = m.split("=")[0];
    try {
      cle = decodeURIComponent(cle);
    } catch {
      /* clé mal encodée : comparée telle quelle */
    }
    return !noms.includes(cle);
  });
  if (gardes.length === morceaux.length) return null;
  return gardes.length ? `?${gardes.join("&")}` : "";
}

interface ContexteDemarrage {
  location: { search: string; hash: string; pathname: string; hostname?: string };
  referrer: string;
  history?: { state: unknown; replaceState: (data: unknown, unused: string, url?: string) => void };
  session?: { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } | null;
}

function contexteNavigateur(): ContexteDemarrage | null {
  if (typeof window === "undefined" || !window.location) return null;
  let session: ContexteDemarrage["session"] = null;
  try {
    session = window.sessionStorage;
  } catch {
    session = null; // stockage bloqué : l'arrivée sera recomptée à chaque rechargement
  }
  return {
    location: window.location,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    history: window.history,
    session,
  };
}

/**
 * Démarrage de la mesure (web) : `?mesure=` d'abord (avant tout envoi), puis l'arrivée, une fois
 * par visite, puis le nettoyage de l'adresse. Ne lève jamais : la mesure ne casse pas l'appli.
 */
export function demarrerMesure(ctx: ContexteDemarrage | null = contexteNavigateur()): void {
  try {
    if (!ctx) return;
    const { location: loc } = ctx;
    const params = new URLSearchParams(loc.search);

    const m = params.get("mesure");
    if (m === "off" || m === "on") reglerMesure(m === "on");

    let deja = false;
    try {
      deja = ctx.session?.getItem(CLE_ARRIVEE) === "1";
      ctx.session?.setItem(CLE_ARRIVEE, "1");
    } catch {
      /* garde indisponible */
    }
    if (!deja) {
      track("arrivee", choisirEntree(loc.hash, params), choisirSource({ hash: loc.hash, params, referrer: ctx.referrer, hoteSite: loc.hostname }));
    }

    const propre = rechercheSans(loc.search, PARAMS_RETIRES);
    if (propre !== null && ctx.history) ctx.history.replaceState(ctx.history.state, "", `${loc.pathname}${propre}${loc.hash}`);
  } catch {
    /* jamais bloquant */
  }
}
