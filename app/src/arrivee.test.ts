import { test } from "node:test";
import assert from "node:assert/strict";
import { CLE_MESURE } from "./analytics";
import {
  CLE_ARRIVEE, CLE_CONTEXTE, categorieReferent, choisirEntree, choisirSource, demarrerMesure, lienOuvrirNavigateur, mesurerContexte,
  rechercheSans, sourceVisite,
} from "./arrivee";
import { ENTREES, SOURCES } from "./mesureListes";

// Espion sur la sortie de track() (sendBeacon) ; une URL posée pour que la mesure parte.
const envois: { t: string; e: string; x: string }[] = [];
Object.defineProperty(globalThis.navigator ?? globalThis, "sendBeacon", {
  configurable: true,
  value: (_url: string, body: string) => { envois.push(JSON.parse(body)); return true; },
});
process.env.EXPO_PUBLIC_ANALYTICS_URL = "https://espion.test/collect";

const memoire = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (memoire.has(k) ? memoire.get(k)! : null),
    setItem: (k: string, v: string) => void memoire.set(k, String(v)),
  },
});

const p = (s: string) => new URLSearchParams(s);

test("référent : catégorie par nom de domaine seulement", () => {
  assert.equal(categorieReferent("https://l.instagram.com/?u=https%3A%2F%2Fscrutoir.fr"), "instagram");
  assert.equal(categorieReferent("https://www.instagram.com/scrutoir/"), "instagram");
  assert.equal(categorieReferent("https://m.facebook.com/"), "facebook");
  assert.equal(categorieReferent("https://l.threads.com/"), "threads");
  assert.equal(categorieReferent("https://t.co/abc"), "x");
  assert.equal(categorieReferent("https://x.com/"), "x");
  assert.equal(categorieReferent("https://www.linkedin.com/feed/"), "linkedin");
  assert.equal(categorieReferent("https://www.google.fr/"), "google");
  assert.equal(categorieReferent("https://www.google.co.uk/"), "google");
  assert.equal(categorieReferent("android-app://com.google.android.googlequicksearchbox/"), "google");
  assert.equal(categorieReferent("android-app://com.google.android.gm/"), "autre_site", "Gmail n'est pas un moteur");
  assert.equal(categorieReferent("https://www.bing.com/"), "bing");
  assert.equal(categorieReferent("https://duckduckgo.com/"), "autre_site");
  assert.equal(categorieReferent("https://notgoogle.com/"), "autre_site");
  assert.equal(categorieReferent("https://evil-instagram.com/"), "autre_site");
});

test("référent : nos pages statiques comptent, l'appli elle-même non", () => {
  assert.equal(categorieReferent("https://scrutoir.fr/depute/PA1234"), "pages_seo");
  assert.equal(categorieReferent("https://www.scrutoir.fr/scrutin/VTANR5L17V1"), "pages_seo");
  assert.equal(categorieReferent("https://scrutoir.fr/"), null);
  assert.equal(categorieReferent("https://scrutoir.pages.dev/"), null);
  assert.equal(categorieReferent(""), null);
  assert.equal(categorieReferent(undefined), null);
  assert.equal(categorieReferent("pas une url"), null);
});

test("source : première règle qui s'applique", () => {
  const ig = "https://l.instagram.com/";
  // 1. partage (hash du test, ou via=partage), avant tout le reste
  assert.equal(choisirSource({ hash: "#test=abc", params: p("source=insta_bio"), referrer: ig }), "partage");
  assert.equal(choisirSource({ hash: "", params: p("open=scrutin:S1&via=partage"), referrer: ig }), "partage");
  // 2. nos liens Instagram
  assert.equal(choisirSource({ hash: "", params: p("source=insta_bio"), referrer: ig }), "insta_bio");
  assert.equal(choisirSource({ hash: "", params: p("source=insta_story") }), "insta_story");
  assert.equal(choisirSource({ hash: "", params: p("source=INSTA_POST") }), "insta_post");
  // 3. l'appli installée
  assert.equal(choisirSource({ hash: "", params: p("source=pwa") }), "pwa");
  // valeur hors liste : jamais transmise
  assert.equal(choisirSource({ hash: "", params: p("source=newsletter-nov"), referrer: ig }), "autre_lien");
  assert.equal(choisirSource({ hash: "", params: p("source=") }), "autre_lien");
  // 4. référent
  assert.equal(choisirSource({ hash: "", params: p(""), referrer: ig }), "instagram");
  // 1 bis. transfert vers l'app (hash ou marque), avant les liens Instagram
  assert.equal(choisirSource({ hash: "#transfert=abc", params: p("") }), "transfert");
  assert.equal(choisirSource({ hash: "", params: p("via=transfert"), referrer: ig }), "transfert");
  // ?source= reprend toute valeur de la liste fermée (lien « Ouvrir dans Safari » depuis Instagram)
  assert.equal(choisirSource({ hash: "", params: p("source=instagram") }), "instagram");
  assert.equal(choisirSource({ hash: "", params: p("source=facebook") }), "facebook");
  // 5. direct
  assert.equal(choisirSource({ hash: "", params: p(""), referrer: "" }), "direct");
  assert.equal(choisirSource({ hash: "", params: p("via=autre"), referrer: "https://scrutoir.fr/" }), "direct");
});

test("entrée : hash du test, lien profond ou accueil", () => {
  assert.equal(choisirEntree("#test=abc", p("")), "test");
  assert.equal(choisirEntree("#transfert=abc", p("")), "test");
  assert.equal(choisirEntree("", p("")), "accueil");
  assert.equal(choisirEntree("", p("open=scrutin:VTANR5L17V1")), "scrutin");
  assert.equal(choisirEntree("", p("open=depute:PA1")), "depute");
  assert.equal(choisirEntree("", p("open=parti:PO1")), "parti");
  assert.equal(choisirEntree("", p("open=presidentielle")), "presidentielle");
  assert.equal(choisirEntree("", p("open=programme:lfi-2027")), "presidentielle");
  assert.equal(choisirEntree("", p("open=mesure:lfi-2027.m1")), "presidentielle");
  assert.equal(choisirEntree("", p("open=texte:DLR5L17N1")), "autre");
  assert.equal(choisirEntree("", p("open=theme:sante")), "autre");
  assert.equal(choisirEntree("", p("open=depute")), "accueil", "sans identifiant, l'appli reste sur l'accueil");
});

test("toutes les valeurs produites appartiennent aux listes fermées", () => {
  const sources = [
    choisirSource({ hash: "", params: p("source=n'importe quoi<script>") }),
    choisirSource({ hash: "", params: p(""), referrer: "https://exemple.org/page?email=a@b.c" }),
  ];
  for (const s of sources) assert.ok((SOURCES as readonly string[]).includes(s), s);
  assert.ok((ENTREES as readonly string[]).includes(choisirEntree("", p("open=bidule:1"))));
});

test("rechercheSans : retire les paramètres, garde l'encodage du reste", () => {
  assert.equal(rechercheSans("?open=depute:PA1&via=partage", ["via", "source", "mesure"]), "?open=depute:PA1");
  assert.equal(rechercheSans("?source=insta_bio", ["via", "source", "mesure"]), "");
  assert.equal(rechercheSans("?open=scrutin%3AS1", ["via"]), null);
  assert.equal(rechercheSans("", ["via"]), null);
  assert.equal(rechercheSans("?mesure=off&open=parti:PO1&x=1", ["via", "source", "mesure"]), "?open=parti:PO1&x=1");
});

/** Contexte de démarrage factice (adresse, référent, historique, sessionStorage). */
function contexte(adresse: string, referrer = "", session = new Map<string, string>()) {
  const u = new URL(adresse);
  const remplacements: string[] = [];
  return {
    remplacements,
    session,
    ctx: {
      location: { search: u.search, hash: u.hash, pathname: u.pathname, hostname: u.hostname },
      referrer,
      history: { state: null, replaceState: (_d: unknown, _t: string, url?: string) => void remplacements.push(url ?? "") },
      session: { getItem: (k: string) => session.get(k) ?? null, setItem: (k: string, v: string) => void session.set(k, v) },
    },
  };
}

test("démarrage : une arrivée, puis l'adresse nettoyée (open et hash gardés)", () => {
  memoire.clear();
  envois.length = 0;
  const c = contexte("https://scrutoir.fr/?open=depute:PA1&via=partage#x", "https://l.instagram.com/");
  demarrerMesure(c.ctx);
  assert.deepEqual(envois.map(({ t, e, x }) => ({ t, e, x })), [{ t: "arrivee", e: "depute", x: "partage" }]);
  assert.deepEqual(c.remplacements, ["/?open=depute:PA1#x"]);
  assert.equal(c.session.get(CLE_ARRIVEE), "partage", "la garde retient la source de la visite");
});

test("démarrage : un rechargement dans le même onglet ne recompte pas l'arrivée", () => {
  memoire.clear();
  envois.length = 0;
  const session = new Map<string, string>();
  demarrerMesure(contexte("https://scrutoir.fr/?source=insta_bio", "", session).ctx);
  demarrerMesure(contexte("https://scrutoir.fr/", "", session).ctx);
  assert.equal(envois.length, 1);
  assert.deepEqual([envois[0].e, envois[0].x], ["accueil", "insta_bio"]);
});

test("démarrage : ?mesure=off règle la clé AVANT l'arrivée (rien ne part), puis ?mesure=on la rétablit", () => {
  memoire.clear();
  envois.length = 0;
  const c = contexte("https://scrutoir.fr/?mesure=off&source=insta_bio");
  demarrerMesure(c.ctx);
  assert.equal(memoire.get(CLE_MESURE), "off");
  assert.equal(envois.length, 0);
  assert.deepEqual(c.remplacements, ["/"]);
  const d = contexte("https://scrutoir.fr/?mesure=on");
  demarrerMesure(d.ctx);
  assert.equal(memoire.get(CLE_MESURE), "on");
  assert.equal(envois.length, 1);
  memoire.clear();
});

test("démarrage : sans sessionStorage ni historique, ne lève pas", () => {
  envois.length = 0;
  assert.doesNotThrow(() =>
    demarrerMesure({ location: { search: "?source=pwa", hash: "", pathname: "/" }, referrer: "", session: null }),
  );
  assert.equal(envois.length, 1);
  assert.doesNotThrow(() => demarrerMesure(null));
});

test("démarrage : la source de la visite survit au rechargement (paramètres retirés de l'adresse)", () => {
  memoire.clear();
  envois.length = 0;
  const session = new Map<string, string>();
  demarrerMesure(contexte("https://scrutoir.fr/?source=insta_bio", "", session).ctx);
  assert.equal(sourceVisite(), "insta_bio");
  demarrerMesure(contexte("https://scrutoir.fr/", "", session).ctx);
  assert.equal(sourceVisite(), "insta_bio");
  // Garde d'avant la v1.44.0 (« 1 ») : source inconnue, rien de recompté.
  demarrerMesure(contexte("https://scrutoir.fr/", "", new Map([[CLE_ARRIVEE, "1"]])).ctx);
  assert.equal(sourceVisite(), "direct");
  assert.equal(envois.length, 1);
});

test("contexte : un seul envoi par visite, avec la source, jamais l'user agent", () => {
  memoire.clear();
  envois.length = 0;
  demarrerMesure(contexte("https://scrutoir.fr/?source=insta_story", "", new Map()).ctx);
  envois.length = 0;
  const s = new Map<string, string>();
  const session = { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v) };
  mesurerContexte("integre-ios", session);
  mesurerContexte("ios", session);
  assert.deepEqual(envois.map(({ t, e, x }) => ({ t, e, x })), [{ t: "contexte", e: "integre-ios", x: "insta_story" }]);
  assert.equal(s.get(CLE_CONTEXTE), "integre-ios");
  assert.ok(!JSON.stringify(envois).includes("Mozilla"));
});

test("ouvrir dans le navigateur : Safari (x-safari-https) ou Android (intent), source reportée", () => {
  const loc = { host: "scrutoir.fr", pathname: "/", search: "", hash: "" };
  assert.equal(lienOuvrirNavigateur("ios", loc, "insta_bio"), "x-safari-https://scrutoir.fr/?source=insta_bio");
  assert.equal(lienOuvrirNavigateur("android", loc, "insta_bio"), "intent://scrutoir.fr/?source=insta_bio#Intent;scheme=https;end");
  // Lien profond et hash gardés sur iOS ; la source retirée de l'adresse revient une seule fois.
  const profond = { host: "scrutoir.fr", pathname: "/", search: "?open=scrutin:VTANR5L17V1&source=insta_post", hash: "#test=abc" };
  assert.equal(lienOuvrirNavigateur("ios", profond, "partage"), "x-safari-https://scrutoir.fr/?open=scrutin:VTANR5L17V1&via=partage#test=abc");
  assert.equal(lienOuvrirNavigateur("android", profond, "insta_post"), "intent://scrutoir.fr/?open=scrutin:VTANR5L17V1&source=insta_post#Intent;scheme=https;end");
  assert.equal(lienOuvrirNavigateur("ios", { ...loc, pathname: "" }, "direct"), "x-safari-https://scrutoir.fr/?source=direct");
});
