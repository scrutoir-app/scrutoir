/**
 * Embedder : un seul exemplaire du modèle sur l'appareil.
 *
 * Le SW met déjà le modèle en cache (`scrutoir-model-*`). transformers.js ne doit pas en
 * ranger une 2e copie dans son propre cache (`transformers-cache`, ~129 Mio), et la copie
 * laissée par les versions précédentes est purgée au chargement du modèle.
 * La lib est simulée (window.__transformers) : aucun modèle chargé ici.
 */
import test from "node:test";
import assert from "node:assert/strict";

test("chargerEmbedder coupe le cache de transformers.js et purge l'ancienne copie", async () => {
  const supprimes: string[] = [];
  const env: any = {
    useBrowserCache: true, // défaut de transformers.js dans un navigateur
    cacheKey: "transformers-cache",
    backends: { onnx: { wasm: {} } },
  };
  const tf = { env, pipeline: async () => () => null };
  Object.assign(globalThis, {
    window: { __transformers: tf },
    document: {},
    caches: {
      delete: async (nom: string) => {
        supprimes.push(nom);
        return true;
      },
    },
  });

  const { chargerEmbedder } = await import("./embedder");
  await chargerEmbedder();

  assert.equal(env.useBrowserCache, false);
  assert.equal(env.allowRemoteModels, false);
  assert.deepEqual(supprimes, ["transformers-cache"]);
});
