#!/usr/bin/env node
/*
 * Injecte les balises PWA dans le dist/index.html généré par `expo export -p web`.
 *
 * Expo (Metro web, sans Expo Router) produit un index.html minimal sans hook de
 * personnalisation du <head> : on patche donc le fichier après export. Idempotent
 * (marqueur SCRUTOIR_PWA), à lancer via `npm run build:web` et dans la CI (étape 4).
 *
 * Ajoute : lang="fr", manifest, theme-color, meta apple, description, et
 * l'enregistrement du service worker (/sw.js, scope racine).
 */
import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distHtml = join(__dirname, "..", "dist", "index.html");
const MARKER = "SCRUTOIR_PWA";

const HEAD_TAGS = `
    <!-- ${MARKER} -->
    <meta name="description" content="Ce que votent réellement les députés français, à partir de l'Open Data de l'Assemblée nationale. Neutre, gratuit, sans pub." />
    <meta name="theme-color" content="#3C4654" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Scrutoir" />`;

const SW_SCRIPT = `
    <!-- ${MARKER}-sw -->
    <script>
      if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/sw.js").catch(function (e) {
            console.warn("SW registration failed", e);
          });
        });
      }
    </script>`;

async function main() {
  try {
    await access(distHtml);
  } catch {
    console.error(`[patch-pwa] introuvable : ${distHtml}\n  Lance d'abord \`expo export -p web\`.`);
    process.exit(1);
  }

  let html = await readFile(distHtml, "utf8");

  if (html.includes(MARKER)) {
    console.log("[patch-pwa] déjà patché, rien à faire.");
    return;
  }

  // lang="fr" (Expo génère lang="en")
  html = html.replace(/<html\s+lang="[^"]*"/i, '<html lang="fr"');

  // Balises <head> avant </head>
  html = html.replace("</head>", `${HEAD_TAGS}\n  </head>`);

  // Enregistrement du SW avant </body>
  html = html.replace("</body>", `${SW_SCRIPT}\n  </body>`);

  await writeFile(distHtml, html, "utf8");
  console.log("[patch-pwa] index.html patché (manifest + theme-color + apple meta + SW).");
}

main();
