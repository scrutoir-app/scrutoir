/**
 * Embedder côté navigateur pour la recherche sémantique — paresseux, hors-ligne, gratuit.
 *
 * Charge `multilingual-e5-small` AUTO-HÉBERGÉ (/models) via `@huggingface/transformers`
 * (onnxruntime-web, WASM auto-hébergé sous /ort). C'est le MÊME modèle que le pipeline
 * (`pipeline/src/embeddings.ts`) → vecteurs compatibles. Aucun appel réseau externe.
 *
 * Le modèle (~130 Mo) n'est téléchargé qu'au PREMIER usage de la recherche sémantique
 * (chargement paresseux), puis mis en cache par le service worker. Préfixe e5 « query: ».
 */
let extractorP: Promise<unknown> | null = null;

/** Charge (une seule fois) le pipeline d'extraction de features. */
export function chargerEmbedder(): Promise<any> {
  if (!extractorP) {
    extractorP = (async () => {
      const tf: any = await import("@huggingface/transformers");
      // Jamais d'appel externe : tout est servi en local (même origine).
      tf.env.allowRemoteModels = false;
      tf.env.allowLocalModels = true;
      tf.env.localModelPath = "/models/";
      const wasm = tf.env.backends?.onnx?.wasm;
      if (wasm) {
        wasm.wasmPaths = "/ort/"; // runtime WASM auto-hébergé
        wasm.numThreads = 1; // pas de cross-origin isolation (COOP/COEP) sur Pages → mono-thread
        wasm.proxy = false;
      }
      return tf.pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });
    })();
  }
  return extractorP as Promise<any>;
}

/** Vectorise une requête utilisateur (préfixe e5 « query: », vecteur normalisé 384 dims). */
export async function embedQuery(texte: string): Promise<Float32Array> {
  const extractor = await chargerEmbedder();
  const out = await extractor("query: " + texte, { pooling: "mean", normalize: true });
  return out.data as Float32Array;
}

// Sonde DEV (à retirer avant prod) : tester depuis la console — await window.__embedQuery("LGBT")
if (typeof window !== "undefined") (window as any).__embedQuery = embedQuery;
