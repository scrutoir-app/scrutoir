// Chargeur de @huggingface/transformers HORS du bundle Metro.
//
// Pourquoi : importer la lib via Metro (Expo web) plante — Metro ne sait pas
// traiter l'`import()` dynamique d'onnxruntime-web. La parade standard est de
// laisser le NAVIGATEUR exécuter nativement l'ESM préfabriqué : ce module est
// chargé par une balise <script type="module" src="/vendor/transformers-loader.mjs">
// injectée à la demande (cf. app/src/search/embedder.ts).
//
// CSP : tout est same-origin (`script-src 'self'`), aucune dépendance CDN.
import * as transformers from "/vendor/transformers.web.min.js";

// Expose la lib au code applicatif (bundlé par Metro) qui lit window.__transformers.
window.__transformers = transformers;
window.dispatchEvent(new CustomEvent("transformers:ready"));
