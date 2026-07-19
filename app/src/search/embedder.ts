/**
 * Embedder côté navigateur pour la recherche sémantique — paresseux, hors-ligne, gratuit.
 *
 * Charge `multilingual-e5-small` AUTO-HÉBERGÉ (/models) via `@huggingface/transformers`
 * (onnxruntime-web, WASM auto-hébergé sous /ort). C'est le MÊME modèle que le pipeline
 * (`pipeline/src/embeddings.ts`) → vecteurs compatibles. Aucun appel réseau externe.
 *
 * ⚠️ La lib N'EST PAS importée via Metro : Metro plante sur l'`import()` dynamique
 * d'onnxruntime-web. On charge le bundle ESM préfabriqué (`/vendor/transformers.web.min.js`)
 * par une balise <script type="module"> injectée à la demande → c'est le navigateur qui
 * exécute nativement le `import()` dynamique. La lib se pose sur `window.__transformers`.
 *
 * ⚠️ Le bundle transformers importe onnxruntime-web par SPECIFIER NU (`onnxruntime-web`,
 * `onnxruntime-web/webgpu`) que le navigateur ne sait pas résoudre sans bundler. On injecte
 * donc un IMPORT MAP (avant la balise loader) qui pointe ces specifiers vers les bundles ESM
 * ort auto-hébergés sous /ort/ (eux-mêmes chargent le .wasm via wasmPaths='/ort/').
 *
 * Le modèle (~118 Mo) n'est téléchargé qu'au PREMIER usage de la recherche sémantique
 * (chargement paresseux), puis mis en cache par le service worker. Préfixe e5 « query: ».
 */

const LOADER_SRC = "/vendor/transformers-loader.mjs";

// Résolution des specifiers nus d'onnxruntime-web vers les bundles ESM auto-hébergés.
const IMPORT_MAP = {
  imports: {
    "onnxruntime-web": "/ort/ort.bundle.min.mjs",
    "onnxruntime-web/webgpu": "/ort/ort.webgpu.bundle.min.mjs",
    // ort.bundle.min.mjs importe onnxruntime-common par specifier nu (feuille ESM).
    "onnxruntime-common": "/ort/common/index.js",
  },
};

/**
 * Déclare l'import map (une seule fois, AVANT tout chargement de module).
 * En PROD, la balise est déjà injectée STATIQUEMENT dans index.html par patch-pwa.mjs
 * (couverte par les hash CSP — une injection runtime serait bloquée) : on la détecte
 * et on ne fait rien. Cette injection runtime reste le repli du dev Expo (sans CSP).
 * ⚠️ IMPORT_MAP ci-dessus doit rester EN PHASE avec IMPORT_MAP_JSON de patch-pwa.mjs
 * (vérifié au build par verifierImportMapSync).
 */
function injecterImportMap(): void {
  if (document.querySelector('script[type="importmap"][data-scrutoir-transformers]')) return;
  const im = document.createElement("script");
  im.type = "importmap";
  im.setAttribute("data-scrutoir-transformers", "1");
  im.textContent = JSON.stringify(IMPORT_MAP);
  document.head.appendChild(im);
}

let libP: Promise<any> | null = null;
let extractorP: Promise<any> | null = null;

/** Charge (une seule fois) la lib transformers.js hors Metro, via balise <script>. */
function chargerLib(): Promise<any> {
  if (libP) return libP;
  libP = new Promise<any>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("transformers indisponible hors navigateur"));
      return;
    }
    // Déjà chargée (ex. réinjection après hot reload) ?
    if ((window as any).__transformers) {
      resolve((window as any).__transformers);
      return;
    }
    const onReady = () => resolve((window as any).__transformers);
    window.addEventListener("transformers:ready", onReady, { once: true });

    // L'import map DOIT précéder le chargement du module loader.
    injecterImportMap();

    // Réutilise la balise si déjà injectée (évite un double <script> au hot reload).
    if (!document.querySelector(`script[type="module"][data-scrutoir-transformers]`)) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = LOADER_SRC;
      s.setAttribute("data-scrutoir-transformers", "1");
      s.onerror = () => {
        window.removeEventListener("transformers:ready", onReady);
        reject(new Error("Échec de chargement de " + LOADER_SRC));
      };
      document.head.appendChild(s);
    }
  });
  // Pas de mise en cache d'un échec : permet un nouvel essai (repli lexical entre-temps).
  libP.catch(() => {
    libP = null;
  });
  return libP;
}

/** Charge (une seule fois) le pipeline d'extraction de features (modèle local). */
export function chargerEmbedder(): Promise<any> {
  if (!extractorP) {
    extractorP = (async () => {
      const tf: any = await chargerLib();
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
      return tf.pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
        dtype: "q8",
        // Options ONNX pour RÉDUIRE l'empreinte mémoire (iOS Safari a un budget d'onglet serré :
        // le modèle ~118 Mo résident + le défilement des résultats faisait dépasser la limite →
        // Safari rechargeait l'onglet). On coupe l'arène mémoire CPU et le plan mémoire, qu'ort
        // pré-alloue au-dessus des poids du modèle. Inférence à peine plus lente, mémoire moindre.
        session_options: { enableCpuMemArena: false, enableMemPattern: false },
      });
    })();
    // Idem : un échec d'init du modèle ne doit pas figer un rejet en cache.
    extractorP.catch(() => {
      extractorP = null;
    });
  }
  return extractorP as Promise<any>;
}

let pret = false;
/** Le modèle a-t-il déjà produit un embedding ? (pour le message « premier lancement »). */
export function embedderEstPret(): boolean {
  return pret;
}

/** Vectorise une requête utilisateur (préfixe e5 « query: », vecteur normalisé 384 dims). */
export async function embedQuery(texte: string): Promise<Float32Array> {
  const extractor = await chargerEmbedder();
  const out = await extractor("query: " + texte, { pooling: "mean", normalize: true });
  pret = true;
  return out.data as Float32Array;
}

