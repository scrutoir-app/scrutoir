import type { Reponse } from "./score";
import {
  b64url,
  chargerTest,
  contenuPartage,
  decoderPartage,
  fusionnerReponses,
  lireContenuPartage,
  sauverTest,
  unb64url,
  type EtatTest,
  type Origine,
  type ReponsesDecodees,
} from "./storage";
import { suivreSansMesure } from "../follows";

/**
 * Transfert des réponses de Safari vers l'app installée (iPhone, iPad).
 *
 * Sur iOS, l'app ajoutée à l'écran d'accueil a son propre stockage, séparé de Safari : un test
 * fait dans Safari n'y apparaît pas. Le seul pont entre les deux, sur le téléphone même, est le
 * presse-papiers : « Copier et installer » y pose un lien, l'app le relit (« Coller mes réponses »).
 *
 * Le contenu reprend celui d'un lien de résultat (`#test=` : réponses, poids, origines) et ajoute
 * les suivis. Il vit dans le HASH de l'URL (`#transfert=`), qui ne part jamais au serveur : aucune
 * requête ne le transporte, ni à la copie, ni au collage, ni à l'ouverture du lien. `?via=transfert`
 * est une marque fixe pour la provenance (arrivee.ts), elle ne dit rien des réponses. Module sans
 * React ni track() : testé hors appli (transfert.test.ts).
 */

/** Version du format : un format futur garde la lecture de celui-ci, un code d'une autre version est refusé. */
export const VERSION_TRANSFERT = 1;

/** uid d'un député (PA…) ou d'un groupe (PO…) suivi. */
const UID_SUIVI = /^P[AO]\d{1,12}$/;
const MAX_SUIVIS = 600;
/** Au-delà, le texte collé n'est pas un lien Scrutoir (garde-fou avant tout décodage). */
const MAX_TEXTE = 50_000;

export interface DonneesTransfert extends ReponsesDecodees {
  suivis: string[];
}

function suivisValides(s: unknown): string[] {
  if (!Array.isArray(s)) return [];
  const vus = new Set<string>();
  for (const u of s) if (typeof u === "string" && UID_SUIVI.test(u) && vus.size < MAX_SUIVIS) vus.add(u);
  return [...vus];
}

/** Code de transfert : `{ v: 1, r, w?, o?, s? }` en base64 URL-safe. */
export function encoderTransfert(etat: Pick<EtatTest, "reponses" | "poids" | "origines">, suivis: string[] = []): string {
  const s = suivisValides(suivis);
  const payload = { v: VERSION_TRANSFERT, ...contenuPartage(etat.reponses, etat.poids, etat.origines), ...(s.length ? { s } : {}) };
  return b64url(JSON.stringify(payload));
}

/** Décode un code de transfert ; null s'il est illisible, d'une autre version, ou vide. */
export function decoderTransfert(code: string): DonneesTransfert | null {
  try {
    const p = JSON.parse(unb64url(code)) as { v?: unknown; s?: unknown } | null;
    if (!p || typeof p !== "object" || p.v !== VERSION_TRANSFERT) return null;
    const d: DonneesTransfert = { ...lireContenuPartage(p), suivis: suivisValides(p.s) };
    return Object.keys(d.reponses).length || d.suivis.length ? d : null;
  } catch {
    return null;
  }
}

/** Origine du site courant (preview comprise), scrutoir.fr hors navigateur. */
function origineSite(): string {
  try {
    if (typeof window !== "undefined" && window.location?.origin && /^https?:/.test(window.location.origin)) return window.location.origin;
  } catch {
    /* ignore */
  }
  return "https://scrutoir.fr";
}

/** Lien de transfert : `https://scrutoir.fr/?via=transfert#transfert=<code>`. */
export function urlTransfert(code: string, origine = origineSite()): string {
  return `${origine}/?via=transfert#transfert=${code}`;
}

/** Le lien de transfert de l'état courant de l'appareil (réponses, poids, origines, suivis). */
export function urlTransfertCourant(suivis: string[]): string | null {
  const etat = chargerTest();
  if (!etat || !Object.keys(etat.reponses).length) return null;
  return urlTransfert(encoderTransfert(etat, suivis));
}

/**
 * Lit un texte collé (ou une adresse) : un lien de transfert (`#transfert=`) ou, à défaut, un
 * lien de résultat (`#test=`, sans suivis). null si rien de Scrutoir ne s'y trouve.
 */
export function lireTexteTransfert(texte: string | null | undefined): { type: "transfert" | "test"; donnees: DonneesTransfert } | null {
  if (!texte || texte.length > MAX_TEXTE) return null;
  const t = texte.match(/[#&]transfert=([A-Za-z0-9_-]+)/);
  if (t) {
    const d = decoderTransfert(t[1]);
    return d ? { type: "transfert", donnees: d } : null;
  }
  const s = texte.match(/[#&]test=([A-Za-z0-9_-]+)/);
  if (s) {
    const d = decoderPartage(s[1]);
    return d && Object.keys(d.reponses).length ? { type: "test", donnees: { ...d, suivis: [] } } : null;
  }
  return null;
}

/**
 * Importe sur l'appareil : réponses fusionnées (`fusionnerReponses`), puis origines « scrutin »
 * et poids restaurés, puis suivis ajoutés sans mesure (aucun track() : un import n'envoie rien).
 * Renvoie le nombre de réponses importées.
 */
export function importerTransfert(d: DonneesTransfert): number {
  const n = Object.keys(d.reponses).length;
  if (n) {
    fusionnerReponses(d.reponses as Record<number, Reponse>);
    const origines = Object.entries(d.origines ?? {});
    const poids = d.poids && Object.keys(d.poids).length ? d.poids : null;
    if (origines.length || poids) {
      const cur = chargerTest();
      const o: Record<number, Origine> = { ...(cur?.origines ?? {}) };
      for (const [id, v] of origines) o[Number(id)] = v;
      sauverTest({ reponses: cur?.reponses ?? {}, poids: { ...(cur?.poids ?? {}), ...(poids ?? {}) }, origines: o });
    }
  }
  for (const uid of d.suivis) suivreSansMesure(uid);
  return n;
}

/** Hash `#transfert=` de l'adresse courante (ouverture du lien collé dans Safari, par exemple). */
export function lireHashTransfert(): DonneesTransfert | null {
  if (typeof window === "undefined" || !window.location?.hash) return null;
  const r = lireTexteTransfert(window.location.hash.includes("transfert=") ? window.location.hash : "");
  return r?.donnees ?? null;
}
