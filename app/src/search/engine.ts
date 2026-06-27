/**
 * Moteur de recherche SÉMANTIQUE côté navigateur.
 *
 * Charge l'index d'embeddings pré-calculé (`/data/embeddings.bin` int8 +
 * `embeddings.meta.json`), vectorise la requête (enrichie par la couche déterministe)
 * avec le MÊME modèle que le pipeline, calcule le cosinus et renvoie les meilleurs
 * scrutins (top-K + coupure RELATIVE — les cosinus sont tassés, pas de seuil absolu).
 *
 * Tout est paresseux : l'index (~2,9 Mo) et le modèle (~118 Mo) ne sont chargés qu'au
 * 1er usage. Le SW les met en cache (hors-ligne). En cas d'échec (modèle indispo,
 * hors-ligne au 1er usage), l'appelant retombe sur la recherche LEXICALE.
 */
import { embedQuery } from "./embedder";
import { routerIntention } from "./intent";

// ⚠️ Verrou de compatibilité : doivent correspondre au pipeline (embeddings.ts
// EMBED_MODEL / EMBED_VERSION). L'en-tête de l'index est vérifié au chargement.
const MODELE_ATTENDU = "Xenova/multilingual-e5-small";
const VERSION_ATTENDUE = "1";
const DIM = 384;

const DATA_BASE = process.env.EXPO_PUBLIC_DATA_BASE ?? "";

export interface ResultatSemantique {
  uid: string;
  score: number; // cosinus [0..1]
}

interface IndexSemantique {
  uids: string[];
  vecteurs: Int8Array; // count * DIM, quantifié
  normes: Float32Array; // norme L2 de chaque ligne int8 (pré-calculée)
  count: number;
}

let indexP: Promise<IndexSemantique> | null = null;

/** Charge + parse l'index une seule fois. Vérifie la compat modèle/version/dim. */
export function chargerIndexSemantique(): Promise<IndexSemantique> {
  if (indexP) return indexP;
  indexP = (async () => {
    const [meta, bin] = await Promise.all([
      fetch(`${DATA_BASE}/data/embeddings.meta.json`).then((r) => {
        if (!r.ok) throw new Error("embeddings.meta.json indisponible");
        return r.json();
      }),
      fetch(`${DATA_BASE}/data/embeddings.bin`).then((r) => {
        if (!r.ok) throw new Error("embeddings.bin indisponible");
        return r.arrayBuffer();
      }),
    ]);
    if (meta.model !== MODELE_ATTENDU || String(meta.version) !== VERSION_ATTENDUE || meta.dim !== DIM) {
      throw new Error(
        `Index incompatible (modèle=${meta.model} v=${meta.version} dim=${meta.dim} ; attendu ${MODELE_ATTENDU} v${VERSION_ATTENDUE} dim${DIM})`
      );
    }
    const uids: string[] = meta.uids;
    const count = uids.length;
    const vecteurs = new Int8Array(bin);
    if (vecteurs.length !== count * DIM) {
      throw new Error(`Taille d'index incohérente (${vecteurs.length} ≠ ${count}×${DIM})`);
    }
    // Pré-calcule la norme L2 de chaque ligne (le cosinus n'a pas besoin de l'échelle :
    // elle se simplifie entre numérateur et dénominateur).
    const normes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let s = 0;
      const base = i * DIM;
      for (let d = 0; d < DIM; d++) {
        const v = vecteurs[base + d];
        s += v * v;
      }
      normes[i] = Math.sqrt(s) || 1e-9;
    }
    return { uids, vecteurs, normes, count };
  })();
  // Ne pas figer un échec en cache (retry possible ; repli lexical entre-temps).
  indexP.catch(() => {
    indexP = null;
  });
  return indexP;
}

export interface OptionsSemantique {
  /** Nombre maxi de candidats renvoyés (avant dédup/fusion). */
  k?: number;
  /** Coupure relative : on garde les scores ≥ (meilleur − ecart). */
  ecart?: number;
  /** Plancher de candidats gardés malgré la coupure. */
  min?: number;
}

/**
 * Recherche sémantique : renvoie les scrutins les plus proches du SUJET de la requête,
 * classés par cosinus décroissant, après coupure relative. Lève si le modèle/index est
 * indisponible (→ l'appelant fait un repli lexical).
 */
export async function rechercheSemantique(
  q: string,
  opts: OptionsSemantique = {}
): Promise<ResultatSemantique[]> {
  const { k = 60, ecart = 0.04, min = 5 } = opts;
  const { enrichi } = routerIntention(q); // expansion d'alias (PMA→…, 49.3→…)
  const [qvec, idx] = await Promise.all([embedQuery(enrichi), chargerIndexSemantique()]);

  // Cosinus = Σ q·v / (|q|·|v|) ; q est déjà normé (|q|=1) → cos = Σ q·v / norme[i].
  const scores = new Float32Array(idx.count);
  for (let i = 0; i < idx.count; i++) {
    let dot = 0;
    const base = i * DIM;
    for (let d = 0; d < DIM; d++) dot += qvec[d] * idx.vecteurs[base + d];
    scores[i] = dot / idx.normes[i];
  }

  // Top-K par tri partiel d'indices.
  const ordre = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]);
  const tete = ordre.slice(0, k);
  if (!tete.length) return [];

  // Coupure relative : cosinus tassés → on garde ce qui est proche du meilleur.
  const meilleur = scores[tete[0]];
  const seuil = meilleur - ecart;
  const out: ResultatSemantique[] = [];
  for (let rang = 0; rang < tete.length; rang++) {
    const i = tete[rang];
    if (rang >= min && scores[i] < seuil) break;
    out.push({ uid: idx.uids[i], score: scores[i] });
  }
  return out;
}

// Sonde DEV (à retirer avant prod) : await window.__rechercheSemantique("droits LGBT")
if (typeof window !== "undefined") (window as any).__rechercheSemantique = rechercheSemantique;
