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
import { LIGHT, DARK } from "../src/theme.ts";
import { geometrieMarque, LOGOTYPE } from "../src/components/brand/geometrie.ts";
import { SAISON_STYLE, SAISON_SCRIPT, verifierPeriodes } from "./splash-saison.mjs";
import { APP_VERSION } from "../src/config.ts";
import { versionnerSw } from "./sw-version.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const distHtml = join(distDir, "index.html");
const MARKER = "SCRUTOIR_PWA";

/*
 * Ouverture officielle « Le point du i » (maquette validée le 2026-11-14, Cowork,
 * instagram/brouillons/animation-logo/animation-logo.html). Remplace « La parole circule » (1.29.0).
 * Le mot Scrutoir s'écrit de gauche à droite (contour puis remplissage). Le point du i se pose,
 * bat une fois, efface le mot en partant de lui, puis saute jusqu'au siège blanc de l'hémicycle
 * (rang extérieur, index 2) en grandissant à la taille d'un siège. Les autres sièges arrivent du
 * sommet vers LES DEUX flancs en même temps (aucun côté avant l'autre), puis la tribune. Le
 * gros rond (la tribune) est au CENTRE EXACT de l'écran, comme sur l'icône et la photo de profil,
 * et n'en bouge plus ; le mot et « Appli citoyenne » apparaissent dessous (décision du 14/11/2026).
 * Tout est dans une seule scène SVG (viewBox 1000 × 1000), animée en JS (requestAnimationFrame) :
 * la trajectoire du point (arc) ne s'exprime pas proprement en CSS. Temps de base (s) × TEMPO.
 * Géométrie lue dans src/components/brand/geometrie.ts (source unique), couleurs dans theme.ts.
 */
const TEMPO = 1;
const ms = (x) => Math.round(x * TEMPO);

// ---------- Scène de l'ouverture (unités du viewBox 0 0 1000 1000) ----------
const SC = (() => {
  const M = geometrieMarque(640); // symbole : ~ 62 % de la largeur de la scène
  const top = Math.min(...M.dots.map((d) => d.y)) - M.dotR;
  const bottom = M.focal.y + M.focal.r;
  const markH = bottom - top;
  const mox = 500 - M.w / 2;
  const moyCentre = 500 - M.focal.y; // le gros rond au centre exact de la scène, donc de l'écran
  const s1 = 1.52, x1 = (1000 - LOGOTYPE.VB_W * s1) / 2, y1 = (1000 - LOGOTYPE.VB_H * s1) / 2; // le mot qui s'écrit
  const s2 = 1.32, x2 = (1000 - LOGOTYPE.VB_W * s2) / 2; // le mot final, sous le symbole
  const wordH = LOGOTYPE.VB_H * s2, gapA = 60, gapB = 45, tagH = 34;
  const top0 = moyCentre + top; // le symbole ne bouge plus : le mot et le slogan se placent dessous
  const y2 = top0 + markH + gapA;
  const tagY = y2 + wordH + gapB + tagH;
  const iBlanc = M.dots.findIndex((d) => d.white);
  const blanc = M.dots[iBlanc];
  const P = LOGOTYPE.point;
  const anneau = M.w / 64; // contour épaissi, comme les icônes et la photo de profil (gen-marque-sombre.mjs)
  const sieges = M.dots
    .map((d, i) => {
      if (d.white) return null;
      const ang = Math.atan2(M.focal.y - d.y, d.x - M.w / 2);
      const depuisSommet = Math.abs(ang - Math.PI / 2) / (Math.PI / 2); // 0 au sommet, 1 aux flancs
      const interieur = i >= 10 ? 1 : 0; // rang intérieur (8 sièges), après le rang extérieur (10)
      return [+d.x.toFixed(2), +d.y.toFixed(2), +(2.1 + depuisSommet * 0.3 + interieur * 0.05).toFixed(3)];
    })
    .filter(Boolean);
  return {
    M, mox, moyCentre, s1, x1, y1, s2, x2, y2, tagY, anneau, sieges,
    depart: { x: x1 + P.cx * s1, y: y1 + P.cy * s1, r: P.r * s1, sw: P.strokeW * s1 },
    arrivee: { x: mox + blanc.x, y: moyCentre + blanc.y },
    traits: LOGOTYPE.d.split(/(?=M)/),
  };
})();
const FIN = 3.4; // fin de l'ouverture, en secondes de base

const HEAD_TAGS = `
    <!-- ${MARKER} -->
    <meta name="description" content="Comment votent les députés français, à partir des données officielles de l'Assemblée nationale. Neutre, gratuit, sans pub." />
    <link rel="canonical" href="https://scrutoir.fr/" />
    <meta name="theme-color" content="#3C4654" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-citron.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Scrutoir" />
    <!-- Open Graph / Twitter : aperçu propre quand on partage le lien (réseaux, presse, messageries) -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Scrutoir" />
    <meta property="og:title" content="Scrutoir. Tes députés votent comment ?" />
    <meta property="og:description" content="Comment votent les députés français, à partir des données officielles de l'Assemblée nationale. Neutre, gratuit, sans pub." />
    <meta property="og:url" content="https://scrutoir.fr/" />
    <meta property="og:image" content="https://scrutoir.fr/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="fr_FR" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Scrutoir. Tes députés votent comment ?" />
    <meta name="twitter:description" content="Comment votent les députés français, à partir des données officielles de l'Assemblée nationale. Neutre, gratuit, sans pub." />
    <meta name="twitter:image" content="https://scrutoir.fr/og.png" />
    <!-- Splash : ouverture officielle « Le point du i » (le mot s'écrit, son point devient le siège), sur fond sombre -->
    <style>
      #scrutoir-splash{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:${LIGHT.bg};transition:opacity .45s ease}
      #scrutoir-splash.ss-hide{opacity:0;pointer-events:none}
      #scrutoir-splash .ss-scene{width:min(260px,68vw);height:auto;display:block;overflow:visible}
      #scrutoir-splash .ss-ink{fill:${LIGHT.text}}
      #scrutoir-splash .ss-trace{fill:none;stroke:${LIGHT.text};stroke-width:42;stroke-linejoin:round}
      #scrutoir-splash .ss-hole{fill:#FFFFFF;stroke:${LIGHT.marqueContour}}
      #scrutoir-splash .ss-focal{fill:#3C4654}
      #scrutoir-splash .ss-tagline{fill:${LIGHT.textFaint};font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:46px;font-weight:600;letter-spacing:7.4px}
      #scrutoir-splash.ss-attente #ss-focal{animation:ss-respire ${ms(1200)}ms ease-in-out infinite alternate}
      @keyframes ss-respire{from{opacity:1}to{opacity:.55}}
      /* Variante sombre : posée D'OFFICE sur le splash (classe ss-sombre du balisage) pour tout le monde depuis la
         1.37.1 (décision du 14/11/2026), intros saisonnières comprises. Siège et point du i en citron. Les règles
         claires ci-dessus restent la base : retirer la classe rend l'ouverture claire (contour encre, logo déposé). */
      #scrutoir-splash.ss-sombre{background:${DARK.bg}}
      #scrutoir-splash.ss-sombre .ss-ink{fill:${DARK.text}}
      #scrutoir-splash.ss-sombre .ss-trace{stroke:${DARK.text}}
      #scrutoir-splash.ss-sombre .ss-hole{fill:${DARK.bg};stroke:${DARK.marqueContour}}
      #scrutoir-splash.ss-sombre .ss-focal{fill:#FFFFFF}
      #scrutoir-splash.ss-sombre .ss-tagline{fill:${DARK.textFaint}}
    </style>`;

const SPLASH_BODY = `
    <!-- ${MARKER}-splash -->
    <div id="scrutoir-splash" class="ss-sombre" role="presentation" aria-hidden="true">
      <svg class="ss-scene" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" aria-label="Scrutoir, appli citoyenne">
        <defs>
          <radialGradient id="ss-plume"><stop offset="0" stop-color="#000"/><stop offset=".82" stop-color="#000"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
          <mask id="ss-efface" maskUnits="userSpaceOnUse" x="-500" y="-500" width="2000" height="2000">
            <rect x="-500" y="-500" width="2000" height="2000" fill="#fff"/>
            <circle id="ss-gomme" cx="${SC.depart.x.toFixed(2)}" cy="${SC.depart.y.toFixed(2)}" r="0" fill="url(#ss-plume)"/>
          </mask>
          <clipPath id="ss-revele" clipPathUnits="userSpaceOnUse"><rect id="ss-rideau" x="${(SC.x1 - 20).toFixed(1)}" y="0" width="0" height="1000"/></clipPath>
        </defs>
        <g id="ss-mot" mask="url(#ss-efface)">
          <g clip-path="url(#ss-revele)">
            <g transform="translate(${SC.x1.toFixed(2)} ${SC.y1.toFixed(2)}) scale(${SC.s1})"><g transform="translate(0 ${LOGOTYPE.ty}) scale(${LOGOTYPE.s} -${LOGOTYPE.s})">
              <path class="ss-ink" d="${LOGOTYPE.d}"/>
            </g></g>
          </g>
          <g transform="translate(${SC.x1.toFixed(2)} ${SC.y1.toFixed(2)}) scale(${SC.s1})"><g transform="translate(0 ${LOGOTYPE.ty}) scale(${LOGOTYPE.s} -${LOGOTYPE.s})">
            ${SC.traits.map((d) => `<path class="ss-trace" d="${d}"/>`).join("")}
          </g></g>
        </g>
        <g id="ss-symbole" transform="translate(${SC.mox.toFixed(2)} ${SC.moyCentre.toFixed(2)})">
          ${SC.sieges.map(([x, y]) => `<circle class="ss-ink ss-siege" cx="${x}" cy="${y}" r="0"/>`).join("")}
          <circle id="ss-focal" class="ss-focal" cx="${SC.M.focal.x.toFixed(2)}" cy="${SC.M.focal.y.toFixed(2)}" r="0"/>
        </g>
        <circle id="ss-point" class="ss-hole" cx="${SC.depart.x.toFixed(2)}" cy="${SC.depart.y.toFixed(2)}" r="0"/>
        <g id="ss-marque" opacity="0">
          <g id="ss-mot2" transform="translate(${SC.x2.toFixed(2)} ${SC.y2.toFixed(2)}) scale(${SC.s2})">
            <g transform="translate(0 ${LOGOTYPE.ty}) scale(${LOGOTYPE.s} -${LOGOTYPE.s})"><path class="ss-ink" d="${LOGOTYPE.d}"/></g>
            <circle id="ss-point2" class="ss-hole" cx="${LOGOTYPE.point.cx}" cy="${LOGOTYPE.point.cy}" r="0" stroke-width="${LOGOTYPE.point.strokeW}"/>
          </g>
          <text id="ss-slogan" class="ss-tagline" x="500" y="${SC.tagY.toFixed(1)}" text-anchor="middle" opacity="0">APPLI CITOYENNE</text>
        </g>
      </svg>
    </div>
    <script>
      (function(){
        var K=${TEMPO},FIN=${FIN};
        var reduit=false;try{reduit=!!window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){}
        var racine=document.getElementById("scrutoir-splash");
        if(racine){
          var $=function(id){return document.getElementById(id);};
          var SIEGES=${JSON.stringify(SC.sieges)},R=${SC.M.dotR.toFixed(3)},AN=${SC.anneau.toFixed(3)};
          var D=${JSON.stringify({ x: +SC.depart.x.toFixed(2), y: +SC.depart.y.toFixed(2), r: +SC.depart.r.toFixed(3), sw: +SC.depart.sw.toFixed(3) })};
          var A=${JSON.stringify({ x: +SC.arrivee.x.toFixed(2), y: +SC.arrivee.y.toFixed(2) })};
          var FR=${SC.M.focal.r.toFixed(3)};
          var X2=${SC.x2.toFixed(2)},Y2=${SC.y2.toFixed(2)},S2=${SC.s2},TY=${SC.tagY.toFixed(1)},PR2=${LOGOTYPE.point.r};
          var traits=[].slice.call(racine.querySelectorAll(".ss-trace")).map(function(p){var L=p.getTotalLength();p.style.strokeDasharray=L;return{el:p,L:L,x:p.getBBox().x};});
          var XMAX=Math.max.apply(null,traits.map(function(k){return k.x;}))||1;
          var sieges=[].slice.call(racine.querySelectorAll(".ss-siege"));
          var rideau=$("ss-rideau"),gomme=$("ss-gomme"),point=$("ss-point"),focal=$("ss-focal"),marque=$("ss-marque"),mot2=$("ss-mot2"),point2=$("ss-point2"),slogan=$("ss-slogan");
          var cl=function(v){return v<0?0:v>1?1:v;},seg=function(t,a,b){return cl((t-a)/(b-a));};
          var eOut=function(p){return 1-Math.pow(1-p,3);},eIn=function(p){return p*p*p;};
          var eIO=function(p){return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;};
          var rebond=function(p){var c=1.70158;return 1+(c+1)*Math.pow(p-1,3)+c*Math.pow(p-1,2);};
          var mix=function(a,b,p){return a+(b-a)*p;};
          function rendu(t){
            // 1. le mot s'écrit de gauche à droite : contour, puis remplissage
            traits.forEach(function(k){var a=0.05+0.5*(k.x/XMAX);k.el.style.strokeDashoffset=k.L*(1-eOut(seg(t,a,a+0.38)));k.el.style.strokeOpacity=1-seg(t,1.0,1.2);});
            rideau.setAttribute("width",(800*eIO(seg(t,0.25,1.05))).toFixed(1));
            // 2. le point du i se pose et bat une fois ; 3. il efface le mot en partant de lui
            var pose=rebond(seg(t,1.05,1.3)),bat=Math.sin(Math.PI*seg(t,1.35,1.55))*0.2;
            gomme.setAttribute("r",(900*eIn(seg(t,1.45,1.95))).toFixed(1));
            // 4. il saute jusqu'au siège blanc et grandit
            var m=eIO(seg(t,1.65,2.15)),monte=-175*Math.sin(Math.PI*m),tasse=Math.sin(Math.PI*seg(t,2.15,2.3))*0.12;
            point.setAttribute("cx",mix(D.x,A.x,m).toFixed(2));
            point.setAttribute("cy",(mix(D.y,A.y,m)+monte).toFixed(2));
            point.setAttribute("r",Math.max(0,mix(D.r,R,m)*pose*(1+bat+tasse)).toFixed(2));
            point.setAttribute("stroke-width",(mix(D.sw,AN,m)*Math.min(1,pose)).toFixed(2));
            // 5. les autres sièges, du sommet vers les deux flancs en même temps ; 6. la tribune
            for(var i=0;i<sieges.length;i++){var t0=SIEGES[i][2];sieges[i].setAttribute("r",Math.max(0,R*rebond(seg(t,t0,t0+0.28))).toFixed(2));}
            focal.setAttribute("r",Math.max(0,FR*rebond(seg(t,2.45,2.75))).toFixed(2));
            // 7. le gros rond reste au centre ; le mot puis « Appli citoyenne » apparaissent dessous
            var w=eOut(seg(t,2.85,3.2));marque.setAttribute("opacity",w.toFixed(3));
            mot2.setAttribute("transform","translate("+X2+" "+(Y2+14*(1-w)).toFixed(1)+") scale("+S2+")");
            point2.setAttribute("r",Math.max(0,PR2*rebond(seg(t,3.1,3.3))).toFixed(2));
            var tg=eOut(seg(t,3.0,3.35));slogan.setAttribute("opacity",tg.toFixed(3));slogan.setAttribute("y",(TY+10*(1-tg)).toFixed(1));
          }
          if(reduit){rendu(FIN);} // animations réduites : le logo final, fixe
          else{
            var debut=null;
            var boucle=function(now){
              if(!document.getElementById("scrutoir-splash"))return; // l'ouverture est partie : on s'arrête
              if(debut===null)debut=now;
              var t=(now-debut)/1000/K;
              rendu(Math.min(t,FIN));
              if(t<FIN)requestAnimationFrame(boucle);
            };
            rendu(0);requestAnimationFrame(boucle);
          }
        }
        // Tenue : la fin de l'ouverture (+ un temps de repos) ; animations réduites : le plancher historique de 1,6 s.
        var t0=Date.now(),TENUE=reduit?1600:${ms(FIN * 1000 + 250)},hidden=false,parti=false,minuteur;
        // Intro saisonnière (splash-saison.mjs, script suivant) : lue au moment de partir via window.__scrutoirSaison.
        function reallyHide(){
          if(parti)return;parti=true;clearTimeout(minuteur);
          var S=window.__scrutoirSaison;if(S)S.depart(); // le décor finit sa course par-dessus l'accueil
          var el=document.getElementById("scrutoir-splash");
          if(!el)return;
          el.classList.add("ss-hide");
          setTimeout(function(){if(el&&el.parentNode)el.parentNode.removeChild(el);},520);
        }
        function hide(){
          if(hidden)return;hidden=true;
          var S=window.__scrutoirSaison,el=document.getElementById("scrutoir-splash");
          if(el&&!reduit){el.style.cursor="pointer";el.addEventListener("click",reallyHide);} // jamais bloquant : une touche passe l'ouverture dès que l'appli est prête
          minuteur=setTimeout(reallyHide,Math.max(0,Math.max(TENUE,S?S.tenue:0)-(Date.now()-t0)));
        }
        setTimeout(function(){ // l'appli tarde au-delà de l'ouverture : seule la tribune respire
          var el=document.getElementById("scrutoir-splash");if(!hidden&&el)el.classList.add("ss-attente");
        },TENUE);
        window.__scrutoirReady=hide;
        setTimeout(hide,7000); // filet de sécurité : ne jamais rester bloqué
      })();
    </script>`;

/**
 * Import map de la recherche sémantique, injecté STATIQUEMENT (et donc couvert par
 * les hash CSP de durcirCsp) — l'injection au runtime par embedder.ts serait bloquée
 * par une CSP à hash sur les navigateurs modernes. embedder.ts détecte cette balise
 * (attribut data-scrutoir-transformers) et saute sa propre injection ; son injection
 * runtime reste le repli du dev Expo (sans CSP). ⚠️ CONTENU À GARDER EN PHASE avec
 * IMPORT_MAP dans src/search/embedder.ts — vérifié au build par verifierImportMapSync().
 */
const IMPORT_MAP_JSON = JSON.stringify({
  imports: {
    "onnxruntime-web": "/ort/ort.bundle.min.mjs",
    "onnxruntime-web/webgpu": "/ort/ort.webgpu.bundle.min.mjs",
    "onnxruntime-common": "/ort/common/index.js",
  },
});
const IMPORTMAP_TAG = `
    <script type="importmap" data-scrutoir-transformers="1">${IMPORT_MAP_JSON}</script>`;

/** Échoue le build si l'import map ci-dessus a divergé de src/search/embedder.ts. */
async function verifierImportMapSync() {
  const src = await readFile(join(__dirname, "..", "src", "search", "embedder.ts"), "utf8");
  const attendu = JSON.parse(IMPORT_MAP_JSON).imports;
  for (const [spec, url] of Object.entries(attendu)) {
    if (!src.includes(`"${spec}": "${url}"`)) {
      console.error(
        `[patch-pwa] IMPORT MAP DÉSYNCHRONISÉ : « ${spec} → ${url} » absent de src/search/embedder.ts.\n` +
        `  Mettre à jour IMPORT_MAP_JSON (patch-pwa.mjs) ET IMPORT_MAP (embedder.ts) ensemble.`
      );
      process.exit(1);
    }
  }
}

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

/**
 * Durcit la CSP de dist/_headers : hash sha256 de CHAQUE <script> inline du
 * index.html FINAL (splash, enregistrement SW, et tout inline qu'Expo ajouterait
 * un jour — on hache ce qui est réellement servi, pas ce qu'on croit injecter).
 * `'unsafe-inline'` est CONSERVÉ dans script-src comme repli pour les très vieux
 * navigateurs : dès qu'un hash est présent, les navigateurs CSP2+ (tous les
 * navigateurs modernes) l'IGNORENT et n'exécutent que les scripts hachés — une
 * injection HTML ne peut donc plus exécuter de script inline arbitraire.
 * Les <script type="application/ld+json"> des pages SEO sont des blocs de
 * données (jamais exécutés) : la CSP script-src ne s'y applique pas.
 */
async function durcirCsp(html) {
  const { createHash } = await import("node:crypto");
  const headersPath = join(distDir, "_headers");
  let headers;
  try {
    headers = await readFile(headersPath, "utf8");
  } catch {
    console.warn("[patch-pwa] dist/_headers introuvable — CSP non durcie.");
    return;
  }
  const hashes = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = (m[1] || "").match(/type="([^"]*)"/i)?.[1];
    if (type && /json/i.test(type)) continue; // blocs de données (ld+json) — jamais exécutés
    hashes.push(`'sha256-${createHash("sha256").update(m[2], "utf8").digest("base64")}'`); // scripts + importmap
  }
  if (!hashes.length) {
    console.warn("[patch-pwa] aucun script inline trouvé — CSP laissée telle quelle.");
    return;
  }
  const nouvelle = headers.replace(
    "script-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' ${hashes.join(" ")}`
  );
  if (nouvelle === headers) {
    console.warn("[patch-pwa] motif « script-src 'self' 'unsafe-inline' » introuvable dans _headers — CSP non durcie.");
    return;
  }
  await writeFile(headersPath, nouvelle, "utf8");
  console.log(`[patch-pwa] CSP durcie : ${hashes.length} hash(es) de script inline injecté(s) dans dist/_headers.`);
}

/*
 * dist/sw.js porte APP_VERSION (cf. sw-version.mjs) : chaque version publiée change le fichier,
 * donc le navigateur propose la mise à jour. Hors marqueur : doit tourner à chaque build.
 */
async function versionnerSwDist() {
  const swPath = join(distDir, "sw.js");
  const avant = await readFile(swPath, "utf8");
  const apres = versionnerSw(avant, APP_VERSION);
  if (apres !== avant) await writeFile(swPath, apres, "utf8");
  console.log(`[patch-pwa] sw.js : ${/const SHELL_VERSION = "([^"]+)"/.exec(apres)[1]}.`);
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
  await versionnerSwDist();

  let html = await readFile(distHtml, "utf8");

  if (html.includes(MARKER)) {
    console.log("[patch-pwa] index.html déjà patché, rien à faire.");
    await durcirCsp(html); // dist/_headers est refait à chaque export : re-hacher quand même
    return;
  }

  // lang="fr" (Expo génère lang="en")
  html = html.replace(/<html\s+lang="[^"]*"/i, '<html lang="fr"');

  // Balises <head> avant </head> (+ styles de l'intro saisonnière + import map statique de la recherche sémantique)
  await verifierImportMapSync();
  verifierPeriodes();
  html = html.replace("</head>", `${HEAD_TAGS}${SAISON_STYLE}${IMPORTMAP_TAG}\n  </head>`);

  // Splash de chargement juste après l'ouverture de <body> (s'affiche avant le bundle),
  // suivi de l'intro saisonnière (inerte hors période planifiée, cf. saisons.mjs).
  html = html.replace(/(<body[^>]*>)/i, `$1${SPLASH_BODY}${SAISON_SCRIPT}`);

  // Enregistrement du SW avant </body>
  html = html.replace("</body>", `${SW_SCRIPT}\n  </body>`);

  await writeFile(distHtml, html, "utf8");
  console.log("[patch-pwa] index.html patché (manifest + theme-color + apple meta + SW).");
  await durcirCsp(html);
}

main();
