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
    <meta name="apple-mobile-web-app-title" content="Scrutoir" />
    <!-- Open Graph / Twitter : aperçu propre quand on partage le lien (réseaux, presse, messageries) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Scrutoir" />
    <meta property="og:title" content="Scrutoir — ce que votent vraiment les députés" />
    <meta property="og:description" content="Les votes réels des députés français, à partir de l'Open Data de l'Assemblée nationale. Neutre, gratuit, sans pub." />
    <meta property="og:url" content="https://scrutoir.fr/" />
    <meta property="og:image" content="https://scrutoir.fr/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Scrutoir — ce que votent vraiment les députés" />
    <meta name="twitter:description" content="Les votes réels des députés français (Open Data Assemblée nationale). Neutre, gratuit, sans pub." />
    <meta name="twitter:image" content="https://scrutoir.fr/og.png" />
    <!-- Splash de chargement : hémicycle dont les sièges s'allument un par un -->
    <style>
      #scrutoir-splash{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:#F2F4F7;transition:opacity .45s ease}
      #scrutoir-splash.ss-hide{opacity:0;pointer-events:none}
      #scrutoir-splash .ss-inner{display:flex;flex-direction:column;align-items:center;gap:20px;transform:translateY(-3%)}
      #scrutoir-splash svg{width:132px;height:auto;display:block}
      #scrutoir-splash .ss-seat{opacity:.16;animation:ss-fill 1.9s ease-in-out infinite}
      #scrutoir-splash .ss-focal{animation:ss-pulse 1.9s ease-in-out infinite}
      #scrutoir-splash .ss-word{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-weight:800;font-size:30px;letter-spacing:.4px;color:#171A1F}
      @keyframes ss-fill{0%{opacity:.16}12%{opacity:1}82%{opacity:1}100%{opacity:.16}}
      @keyframes ss-pulse{0%,100%{opacity:.5}40%{opacity:1}}
      @media (prefers-reduced-motion:reduce){#scrutoir-splash .ss-seat{opacity:1;animation:none}#scrutoir-splash .ss-focal{animation:none}}
      /* iOS Safari : la racine suit le viewport VISIBLE (dvh) pour que la barre d'onglets
         ne passe pas sous la barre d'outils du navigateur (sans changer sa hauteur).
         Repli height:100% si dvh non supporté. Pas de viewport-fit=cover : on ne veut pas
         étendre sous le home indicator (ça gonflait la barre). */
      html, body { height: 100%; }
      #root { height: 100vh; height: 100dvh; }
    </style>`;

const SPLASH_BODY = `
    <!-- ${MARKER}-splash -->
    <div id="scrutoir-splash" role="presentation" aria-hidden="true">
      <div class="ss-inner">
        <svg viewBox="0 4 120 88" xmlns="http://www.w3.org/2000/svg" aria-label="Scrutoir"></svg>
        <div class="ss-word">Scrutoir</div>
      </div>
    </div>
    <script>
      (function(){
        var NS="http://www.w3.org/2000/svg";
        var svg=document.querySelector("#scrutoir-splash svg");
        if(svg){
          var w=120,h=w*0.72,cx=w/2,cy=h*0.84,rings=[w*0.44,w*0.31],dotR=w*0.046;
          var seats=[];
          rings.forEach(function(R,ri){
            var n=9-ri*2;
            for(var i=0;i<=n;i++){var t=Math.PI*(i/n);seats.push({x:cx+R*Math.cos(t),y:cy-R*Math.sin(t),t:t});}
          });
          seats.sort(function(a,b){return a.t-b.t;}); // s'allument en balayant l'hémicycle
          seats.forEach(function(s,i){
            var c=document.createElementNS(NS,"circle");
            c.setAttribute("cx",s.x.toFixed(2));c.setAttribute("cy",s.y.toFixed(2));
            c.setAttribute("r",dotR.toFixed(2));c.setAttribute("fill","#171A1F");
            c.setAttribute("class","ss-seat");
            c.style.animationDelay=(i*0.07).toFixed(3)+"s";
            svg.appendChild(c);
          });
          var f=document.createElementNS(NS,"circle"); // point focal (tribune/pupille)
          f.setAttribute("cx",cx);f.setAttribute("cy",cy.toFixed(2));f.setAttribute("r",(w*0.1).toFixed(2));
          f.setAttribute("fill","#3C4654");f.setAttribute("class","ss-focal");
          svg.appendChild(f);
        }
        var t0=Date.now(),MIN=1600,hidden=false; // plancher : l'anim reste visible >= 1,6 s (le temps que l'hémicycle finisse de se remplir)
        function reallyHide(){
          var el=document.getElementById("scrutoir-splash");
          if(!el)return;
          el.classList.add("ss-hide");
          setTimeout(function(){if(el&&el.parentNode)el.parentNode.removeChild(el);},520);
        }
        function hide(){
          if(hidden)return;hidden=true;
          setTimeout(reallyHide,Math.max(0,MIN-(Date.now()-t0)));
        }
        window.__scrutoirReady=hide;
        setTimeout(hide,7000); // filet de sécurité : ne jamais rester bloqué
      })();
    </script>`;

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

  // Splash de chargement juste après l'ouverture de <body> (s'affiche avant le bundle)
  html = html.replace(/(<body[^>]*>)/i, `$1${SPLASH_BODY}`);

  // Enregistrement du SW avant </body>
  html = html.replace("</body>", `${SW_SCRIPT}\n  </body>`);

  await writeFile(distHtml, html, "utf8");
  console.log("[patch-pwa] index.html patché (manifest + theme-color + apple meta + SW).");
}

main();
