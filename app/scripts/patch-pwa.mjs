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
import { readFile, writeFile, access, rename, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const distHtml = join(distDir, "index.html");
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
        // Mise à jour automatique : pas de réinstallation manuelle pour les utilisateurs.
        // Quand un nouveau service worker prend le contrôle, on recharge une seule fois.
        var hadController = !!navigator.serviceWorker.controller;
        var refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", function () {
          if (refreshing) return;
          if (!hadController) { hadController = true; return; } // 1ʳᵉ visite : ne pas recharger
          refreshing = true;
          window.location.reload();
        });
        window.addEventListener("load", function () {
          navigator.serviceWorker.register("/sw.js").then(function (reg) {
            reg.update(); // vérifie une nouvelle version au lancement
            document.addEventListener("visibilitychange", function () {
              if (document.visibilityState === "visible") reg.update(); // … et à chaque réouverture
            });
          }).catch(function (e) {
            console.warn("SW registration failed", e);
          });
        });
      }
    </script>`;

/*
 * ⚠️ Cloudflare Pages IGNORE les dossiers `node_modules` à l'upload. Or Expo range
 * les polices d'icônes (@expo/vector-icons) et Manrope dans `dist/assets/node_modules/…`
 * → non déployées → icônes en carrés vides. Correctif : renommer ce dossier en
 * `assets/vendor` et réécrire les références `assets/node_modules` → `assets/vendor`
 * dans le bundle JS (les 26 occurrences sont uniquement ces chemins de polices).
 */
async function fixVendorFonts() {
  const oldDir = join(distDir, "assets", "node_modules");
  const newDir = join(distDir, "assets", "vendor");
  let renamed = false;
  try {
    await access(oldDir);
    await rename(oldDir, newDir);
    renamed = true;
  } catch {
    /* déjà renommé ou absent → rien à faire */
  }

  // Réécrit les références dans les fichiers texte (js/css/html) sous dist.
  let patched = 0;
  async function walk(dir) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(p);
      } else if (/\.(js|css|html)$/.test(e.name)) {
        const txt = await readFile(p, "utf8");
        if (txt.includes("assets/node_modules")) {
          await writeFile(p, txt.split("assets/node_modules").join("assets/vendor"), "utf8");
          patched++;
        }
      }
    }
  }
  await walk(distDir);

  if (renamed || patched) {
    console.log(`[patch-pwa] polices vendor déplacées hors de node_modules (dossier renommé: ${renamed}, fichiers réécrits: ${patched}).`);
  } else {
    console.log("[patch-pwa] polices vendor : déjà OK, rien à faire.");
  }
}

async function main() {
  try {
    await access(distHtml);
  } catch {
    console.error(`[patch-pwa] introuvable : ${distHtml}\n  Lance d'abord \`expo export -p web\`.`);
    process.exit(1);
  }

  // Correctif polices (indépendant du marqueur : doit tourner à chaque build).
  await fixVendorFonts();

  let html = await readFile(distHtml, "utf8");

  if (html.includes(MARKER)) {
    console.log("[patch-pwa] index.html déjà patché, rien à faire.");
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
