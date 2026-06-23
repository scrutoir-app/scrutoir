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
    <link rel="canonical" href="https://scrutoir.fr/" />
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
      #scrutoir-splash .ss-word{width:172px;height:auto;display:block}
      @keyframes ss-fill{0%{opacity:.16}12%{opacity:1}82%{opacity:1}100%{opacity:.16}}
      @keyframes ss-pulse{0%,100%{opacity:.5}40%{opacity:1}}
      @media (prefers-reduced-motion:reduce){#scrutoir-splash .ss-seat{opacity:1;animation:none}#scrutoir-splash .ss-focal{animation:none}}
    </style>`;

const SPLASH_BODY = `
    <!-- ${MARKER}-splash -->
    <div id="scrutoir-splash" role="presentation" aria-hidden="true">
      <div class="ss-inner">
        <svg viewBox="0 4 120 88" xmlns="http://www.w3.org/2000/svg" aria-label="Scrutoir"></svg>
        <svg class="ss-word" viewBox="0 0 500.22 160.80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g transform="translate(0 120) scale(0.06 -0.06)">
            <path fill="#171A1F" d="M684 -30Q524 -30 395.5 26.5Q267 83 184.5 188.5Q102 294 80 440L364 482Q394 358 488.0 291.0Q582 224 702 224Q769 224 832.0 245.0Q895 266 935.5 307.0Q976 348 976 408Q976 430 969.5 450.5Q963 471 948.0 489.0Q933 507 905.5 523.0Q878 539 836 552L462 662Q420 674 364.5 696.0Q309 718 257.0 759.0Q205 800 170.5 867.5Q136 935 136 1038Q136 1183 209.0 1279.0Q282 1375 404.0 1422.0Q526 1469 674 1468Q823 1466 940.0 1417.0Q1057 1368 1136.0 1274.5Q1215 1181 1250 1046L956 996Q940 1066 897.0 1114.0Q854 1162 794.5 1187.0Q735 1212 670 1214Q606 1216 549.5 1196.5Q493 1177 457.5 1140.0Q422 1103 422 1052Q422 1005 451.0 975.5Q480 946 524.0 928.0Q568 910 614 898L864 830Q920 815 988.0 790.5Q1056 766 1118.5 722.5Q1181 679 1221.5 608.0Q1262 537 1262 428Q1262 312 1213.5 225.5Q1165 139 1083.0 82.5Q1001 26 897.5 -2.0Q794 -30 684 -30ZM1983 -30Q1815 -30 1695.0 45.0Q1575 120 1511.0 249.0Q1447 378 1447 540Q1447 704 1513.5 833.0Q1580 962 1701.0 1036.0Q1822 1110 1987 1110Q2178 1110 2307.5 1013.5Q2437 917 2473 750L2201 678Q2177 762 2117.5 809.0Q2058 856 1983 856Q1897 856 1842.0 814.5Q1787 773 1761.0 701.5Q1735 630 1735 540Q1735 399 1797.5 311.5Q1860 224 1983 224Q2075 224 2123.0 266.0Q2171 308 2195 386L2473 328Q2427 156 2299.0 63.0Q2171 -30 1983 -30ZM2698 0V1080H2938V816L2912 850Q2933 906 2968.0 952.0Q3003 998 3054 1028Q3093 1052 3139.0 1065.5Q3185 1079 3234.0 1082.5Q3283 1086 3332 1080V826Q3287 840 3227.5 835.5Q3168 831 3120 808Q3072 786 3039.0 749.5Q3006 713 2989.0 663.5Q2972 614 2972 552V0ZM3949 -32Q3822 -32 3742.0 11.0Q3662 54 3617.5 120.0Q3573 186 3554.0 257.5Q3535 329 3531.0 388.0Q3527 447 3527 474V1080H3803V570Q3803 533 3807.0 475.5Q3811 418 3832.0 360.0Q3853 302 3900.5 263.0Q3948 224 4035 224Q4070 224 4110.0 235.0Q4150 246 4185.0 277.5Q4220 309 4242.5 370.5Q4265 432 4265 532L4421 458Q4421 330 4369.0 218.0Q4317 106 4212.5 37.0Q4108 -32 3949 -32ZM4299 0V358H4265V1080H4539V0ZM5492 0Q5380 -21 5272.5 -18.5Q5165 -16 5080.5 19.5Q4996 55 4952 134Q4912 208 4910.0 284.5Q4908 361 4908 458V1380H5180V474Q5180 411 5181.5 360.5Q5183 310 5202 280Q5238 223 5317.0 218.0Q5396 213 5492 226ZM4724 870V1080H5492V870ZM6243 -30Q6080 -30 5957.0 43.0Q5834 116 5765.5 244.5Q5697 373 5697 540Q5697 709 5767.0 837.5Q5837 966 5960.0 1038.0Q6083 1110 6243 1110Q6406 1110 6529.5 1037.0Q6653 964 6722.0 835.5Q6791 707 6791 540Q6791 372 6721.5 243.5Q6652 115 6528.5 42.5Q6405 -30 6243 -30ZM6243 224Q6374 224 6438.5 312.5Q6503 401 6503 540Q6503 684 6437.5 770.0Q6372 856 6243 856Q6154 856 6097.0 816.0Q6040 776 6012.5 705.0Q5985 634 5985 540Q5985 395 6050.5 309.5Q6116 224 6243 224ZM7056 0V1080H7328V0ZM7653 0V1080H7893V816L7867 850Q7888 906 7923.0 952.0Q7958 998 8009 1028Q8048 1052 8094.0 1065.5Q8140 1079 8189.0 1082.5Q8238 1086 8287 1080V826Q8242 840 8182.5 835.5Q8123 831 8075 808Q8027 786 7994.0 749.5Q7961 713 7944.0 663.5Q7927 614 7927 552V0Z"/>
          </g>
          <circle cx="431.52" cy="31.80" r="10.20" fill="#FFFFFF" stroke="#171A1F" stroke-width="4.50"/>
        </svg>
      </div>
    </div>
    <script>
      (function(){
        var NS="http://www.w3.org/2000/svg";
        var svg=document.querySelector("#scrutoir-splash svg");
        if(svg){
          var w=120,h=w*0.72,cx=w/2,cy=h*0.84,rings=[w*0.44,w*0.31],dotR=w*0.046,strokeW=Math.max(1,w*0.0085);
          var seats=[];
          rings.forEach(function(R,ri){
            var n=9-ri*2;
            for(var i=0;i<=n;i++){var t=Math.PI*(i/n);seats.push({x:cx+R*Math.cos(t),y:cy-R*Math.sin(t),t:t,white:(ri===0&&i===2)});}
          });
          seats.sort(function(a,b){return a.t-b.t;}); // s'allument en balayant l'hémicycle
          seats.forEach(function(s,i){
            var c=document.createElementNS(NS,"circle");
            c.setAttribute("cx",s.x.toFixed(2));c.setAttribute("cy",s.y.toFixed(2));
            c.setAttribute("r",dotR.toFixed(2));
            if(s.white){ // siège blanc contour encre (jumeau du point du « i »)
              c.setAttribute("fill","#FFFFFF");c.setAttribute("stroke","#171A1F");c.setAttribute("stroke-width",strokeW.toFixed(2));
            }else{
              c.setAttribute("fill","#171A1F");
            }
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
  // Le sitemap.xml et les pages SEO sont générés ensuite par `prerender-seo.mjs`.
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
