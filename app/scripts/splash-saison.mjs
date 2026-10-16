/*
 * Intro saisonnière du splash, injectée par patch-pwa.mjs : UNE surcouche (#scrutoir-saison)
 * posée au-dessus du splash et de l'appli, qui ne capte aucune touche (pointer-events:none).
 * Règles (charte scrutoir-design, « Animations saisonnières ») :
 *  - jouée seulement pendant une période de saisons.mjs (ou ?saison=<id> pour prévisualiser) ;
 *  - coupure totale si « réduire les animations » est actif : aucun décor ;
 *  - jamais sur le swipe : l'appli appelle __scrutoirSaison.stop() à l'entrée du test ;
 *  - couleurs = tokens saison* de theme.ts. La lune et son halo partent avec le splash :
 *    seules des silhouettes neutres finissent leur vol au-dessus de l'accueil ;
 *  - le logo n'est jamais touché : le décor vit autour, dans un repère centré sur le logo ;
 *  - thème sombre de l'utilisateur (clé scrutoir.scheme de theme.ts) : splash ET décor passent
 *    en sombre, PENDANT l'intro seulement (hors période, le splash reste clair).
 * Décors (un par id de saisons.mjs ; une seule teinte, rien de religieux) :
 *  - halloween (maquette validée le 2026-10-16) : lune, toile, chauves-souris ; splash tenu
 *    3,4 s (une touche le passe dès que l'appli est prête), surcouche retirée à 5,1 s ;
 *  - neige et minuit (maquette « maquette-ouverture-fetes », validée le 2026-10-16) : neige qui
 *    s'efface à l'approche du logo ; gerbes dorées au-dessus du logo. Splash tenu 3,4 s, tout
 *    part avec le splash. Splash SOMBRE POUR TOUS pendant ces intros (décision du 2026-10-16 :
 *    flocons et gerbes ne se voient pas sur fond clair) ; l'appli garde ensuite le thème choisi.
 */
import { LIGHT, DARK, MOTION } from "../src/theme.ts";
import { PERIODES, saisonActive } from "./saisons.mjs";

export const DECORS = ["halloween", "neige", "minuit"];
const TENUE_MS = 3400; // splash tenu pendant l'intro

/** Échoue le build si une période planifiée n'a pas de décor ou est mal formée. */
export function verifierPeriodes() {
  for (const p of PERIODES) {
    const ok = DECORS.includes(p.id) && /^\d\d-\d\d$/.test(p.debut) && /^\d\d-\d\d$/.test(p.fin);
    if (!ok) {
      console.error(
        `[patch-pwa] période saisonnière invalide : ${JSON.stringify(p)} (scripts/saisons.mjs).\n` +
        `  Attendu : id parmi ${DECORS.join(", ")}, debut et fin au format MM-JJ.`
      );
      process.exit(1);
    }
  }
}

const EASE_OUT = "cubic-bezier(.2,0,0,1)";
const EASE_IN = "cubic-bezier(.3,0,1,1)";
const EASE_IO = "cubic-bezier(.4,0,.2,1)";

/** Toile d'araignée du coin haut gauche : rayons, puis fils qui s'affaissent entre eux. */
function toile() {
  const angles = [0, 22.5, 45, 67.5, 90];
  const pt = (r, a) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
  const f = (n) => n.toFixed(1);
  let out = "";
  angles.forEach((a, i) => {
    const p = pt(122, a);
    out += `<path pathLength="1" style="animation-delay:${300 + i * 90}ms" d="M0 0 L${f(p[0])} ${f(p[1])}"/>`;
  });
  [32, 56, 80, 104].forEach((r, ri) => {
    let d = "";
    for (let i = 0; i < angles.length - 1; i++) {
      const a = pt(r, angles[i]), b = pt(r, angles[i + 1]), m = pt(r * 0.86, (angles[i] + angles[i + 1]) / 2);
      d += (i === 0 ? `M${f(a[0])} ${f(a[1])}` : "") + ` Q${f(m[0])} ${f(m[1])} ${f(b[0])} ${f(b[1])}`;
    }
    out += `<path pathLength="1" style="animation-delay:${750 + ri * 180}ms" d="${d}"/>`;
  });
  return out;
}

const ARAIGNEE =
  '<svg viewBox="0 0 16 18" width="16" height="18"><g stroke-width="1.1" stroke-linecap="round" fill="none">' +
  '<path d="M6 8 L1.5 5 M6 9.5 L1 9.5 M6 11 L1.5 14 M6.6 12.4 L3.5 17 M10 8 L14.5 5 M10 9.5 L15 9.5 M10 11 L14.5 14 M9.4 12.4 L12.5 17"/></g>' +
  '<circle cx="8" cy="5.4" r="2.2" stroke="none"/><ellipse cx="8" cy="10.6" rx="3.4" ry="4" stroke="none"/></svg>';

const CHAUVE_SOURIS =
  '<svg viewBox="0 0 40 20" width="100%">' +
  '<g class="sz-aile"><path d="M20 9.5 C16.5 6.2 11.5 5.2 4 7.4 C6.2 8.6 7.2 10.2 6.8 12.4 C8.6 11.1 10.4 11.2 11.8 13 C12.8 11.5 14.6 11.2 16.6 12.4 C17.4 11.1 18.6 10.6 20 11 Z"/></g>' +
  '<g class="sz-aile"><path d="M20 9.5 C23.5 6.2 28.5 5.2 36 7.4 C33.8 8.6 32.8 10.2 33.2 12.4 C31.4 11.1 29.6 11.2 28.2 13 C27.2 11.5 25.4 11.2 23.4 12.4 C22.6 11.1 21.4 10.6 20 11 Z"/></g>' +
  '<ellipse cx="20" cy="11.2" rx="2.4" ry="3.6"/><circle cx="20" cy="7.4" r="2.1"/>' +
  '<path d="M18.6 6.4 L18.1 4.1 L19.6 5.6 Z M21.4 6.4 L21.9 4.1 L20.4 5.6 Z"/></svg>';

// Chauves-souris : [largeur px, durée du vol, départ, battement d'aile] (ms). 1re vague pendant
// que la lune monte, 2e vague qui croise la lune puis survole l'accueil.
const VOLS = [
  [50, 2200, 1300, 150],
  [38, 2300, 1450, 135],
  [28, 2600, 1700, 120],
  [42, 2300, 2500, 135],
  [24, 2200, 2750, 120],
];

// ---------- Halloween ----------
const MARKUP_HALLOWEEN =
  `<svg class="sz-toile" viewBox="0 0 128 128">${toile()}</svg>` +
  `<div class="sz-araignee">${ARAIGNEE}</div>` +
  '<div class="sz-scene"><div class="sz-lune-wrap"><div class="sz-halo"></div><div class="sz-lune">' +
  '<i style="left:16px;top:20px;width:14px;height:14px;opacity:.5"></i>' +
  '<i style="left:44px;top:40px;width:10px;height:10px;opacity:.45"></i>' +
  '<i style="left:30px;top:50px;width:6px;height:6px;opacity:.4"></i></div></div>' +
  VOLS.map((_, i) => `<div class="sz-cs sz-c${i + 1}">${CHAUVE_SOURIS}</div>`).join("") +
  "</div>";

// Vols : repère centré sur le logo ; départ et arrivée repoussés hors écran selon la largeur
// (X), pour ne jamais voir une chauve-souris surgir de nulle part.
const INIT_HALLOWEEN = `function(el){
          var vol=false;try{vol=CSS.supports("offset-path",'path("M0 0")');}catch(e){}
          var X=Math.max(210,(window.innerWidth||375)/2+40);
          var T=[
            "M "+(-X)+" -86 C -110 -118, -20 -178, 92 -205 S 210 -266, "+(X+50)+" -296",
            "M "+(-X)+" -62 C -130 -96, -78 -156, 2 -188 S 130 -248, "+(X+30)+" -266",
            "M "+X+" -108 C 162 -138, 132 -180, 82 -220 S -30 -288, "+(-X)+" -330",
            "M "+(-X)+" -120 C -130 -155, -50 -195, 40 -220 S 170 -270, "+(X+30)+" -340",
            "M "+X+" -40 C 170 -70, 130 -130, 85 -165 S -20 -230, "+(-X)+" -220"
          ];
          var cs=el.querySelectorAll(".sz-cs");
          for(var i=0;i<cs.length;i++){if(vol)cs[i].style.offsetPath='path("'+T[i]+'")';else cs[i].style.display="none";}
        }`;

// ---------- Neige (19 → 31 décembre) ----------
// Flocons ronds cerclés d'un filet (lisibles sur fond clair) et quelques cristaux qui tournent.
// Tirage reproductible ; densité proportionnelle à la surface de l'écran ; une partie tombe déjà
// au lancement. Un masque centré sur le logo les efface à son approche : le logo reste net.
const CRISTAL =
  '<svg viewBox="-10 -10 20 20"><path d="M0 -9 V9 M-7.8 -4.5 L7.8 4.5 M-7.8 4.5 L7.8 -4.5 M0 -9 L-2 -6.5 M0 -9 L2 -6.5 M0 9 L-2 6.5 M0 9 L2 6.5 M-7.8 -4.5 L-4.6 -4.6 M-7.8 -4.5 L-6.2 -1.8 M7.8 4.5 L4.6 4.6 M7.8 4.5 L6.2 1.8 M-7.8 4.5 L-6.2 1.8 M-7.8 4.5 L-4.6 4.6 M7.8 -4.5 L6.2 -1.8 M7.8 -4.5 L4.6 -4.6"/></svg>';
const MARKUP_NEIGE = '<div class="sz-couche"><div class="sz-neige"></div></div>';
const INIT_NEIGE = `function(el){
          var W=window.innerWidth||375,H=window.innerHeight||700,n=Math.max(30,Math.min(90,Math.round(44*W*H/251600))),seed=19122026,h="";
          function R(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}
          var C=${JSON.stringify(CRISTAL)};
          for(var i=0;i<n;i++){
            var c=i%7===3,p=R(),s=c?10+p*6:2+p*3.4,d=5200+(1-p)*3400,dl=i<n*0.64?-R()*d:R()*1800;
            h+='<div class="sz-flocon'+(c?' sz-cristal':'')+'" style="left:'+Math.round(R()*W)+'px;--s:'+s.toFixed(1)+'px;--d:'+Math.round(d)+'ms;--dl:'+Math.round(dl)+'ms;--a:'+(5+R()*10).toFixed(1)+'px;--dd:'+Math.round(1700+R()*1700)+'ms;--o:'+(0.45+p*0.5).toFixed(2)+'"><i>'+(c?C:'')+'</i></div>';
          }
          var z=el.querySelector(".sz-neige");z.style.setProperty("--chute",(H+40)+"px");z.innerHTML=h;
        }`;

// ---------- Minuit (1er → 5 janvier) ----------
// Gerbes dorées : [x, y, taille, départ (ms), montée de la fusée (px)], repère centré sur le
// logo. Toutes au-dessus du logo (≥ 20 px d'écart), fusées comprises, sur écrans de 640 à 740 px.
const FEUX = [[-78, -236, 1.15, 500, 104], [84, -262, 1.0, 1100, 120], [4, -280, 1.2, 1650, 120], [-30, -184, 0.8, 2200, 57]];
function feux() {
  const f = (n) => Math.round(n * 10) / 10;
  let svg = '<svg class="sz-feux" viewBox="-170 -370 340 740">';
  for (const [x, y, s, t, r] of FEUX) {
    let g = "";
    for (let i = 0; i < 14; i++) {
      const a = (i * 2 * Math.PI) / 14 + 0.1;
      g += `<line x1="${f(9 * s * Math.cos(a))}" y1="${f(9 * s * Math.sin(a))}" x2="${f(27 * s * Math.cos(a))}" y2="${f(27 * s * Math.sin(a))}"/>`;
    }
    for (let j = 0; j < 7; j++) {
      const b = (j * 2 * Math.PI) / 7 + 0.1 + Math.PI / 14;
      g += `<circle stroke="none" r="${f(1.5 * s)}" cx="${f(33 * s * Math.cos(b))}" cy="${f(33 * s * Math.sin(b))}"/>`;
    }
    svg += `<g transform="translate(${x} ${y})" style="--t:${t}ms;--r:${r}px"><circle class="sz-fusee" r="1.8"/><g class="sz-gerbe">${g}</g></g>`;
  }
  return svg + "</svg>";
}
const MARKUP_MINUIT = `<div class="sz-couche">${feux()}</div>`;

const vars = (t) =>
  `--sz-lune:${t.saisonLune};--sz-halo:${t.saisonHalo};--sz-silhouette:${t.saisonSilhouette};--sz-fil:${t.hairlineStrong};` +
  `--sz-neige:${t.saisonNeige};--sz-or:${t.saisonOr}`;

/** Styles de la surcouche (dans <head>, inertes hors période : la surcouche n'existe pas). */
export const SAISON_STYLE = `
    <style>
      #scrutoir-saison{position:fixed;inset:0;z-index:2147483601;pointer-events:none;overflow:hidden;${vars(LIGHT)}}
      #scrutoir-saison.sz-sombre{${vars(DARK)}}
      #scrutoir-saison *{pointer-events:none}
      #scrutoir-saison .sz-scene{position:absolute;left:50%;top:50%;width:0;height:0}
      #scrutoir-saison .sz-lune-wrap{position:absolute;left:92px;top:-205px}
      #scrutoir-saison .sz-halo{position:absolute;left:-100px;top:-100px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,var(--sz-halo) 0%,transparent 68%);opacity:0;transform:scale(.85);animation:sz-eclat 1400ms ${EASE_OUT} 450ms forwards,sz-respire 2400ms ease-in-out 1850ms infinite alternate}
      #scrutoir-saison .sz-lune{position:absolute;left:-38px;top:-38px;width:76px;height:76px;border-radius:50%;background:var(--sz-lune);opacity:0;transform:translateY(18px);animation:sz-eclat 1200ms ${EASE_OUT} 200ms forwards}
      #scrutoir-saison .sz-lune i{position:absolute;border-radius:50%;background:color-mix(in srgb,var(--sz-lune) 84%,var(--sz-silhouette))}
      #scrutoir-saison .sz-toile{position:absolute;left:0;top:0;width:128px;height:128px;overflow:visible}
      #scrutoir-saison .sz-toile path{fill:none;stroke:var(--sz-fil);stroke-width:1;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:sz-trace 1100ms ${EASE_OUT} forwards}
      #scrutoir-saison .sz-araignee{position:absolute;left:78px;top:-26px;width:16px;height:18px;animation:sz-descend 900ms ${EASE_OUT} 1100ms forwards,sz-balance 1600ms ease-in-out 2000ms infinite alternate}
      #scrutoir-saison .sz-araignee::before{content:"";position:absolute;bottom:100%;left:50%;width:1px;height:400px;background:var(--sz-fil)}
      #scrutoir-saison .sz-araignee svg{display:block;fill:var(--sz-silhouette);stroke:var(--sz-silhouette)}
      #scrutoir-saison .sz-cs{position:absolute;left:0;top:0;offset-rotate:0deg;opacity:0}
      #scrutoir-saison .sz-cs svg{display:block;fill:var(--sz-silhouette)}
      #scrutoir-saison .sz-aile{transform-box:view-box;transform-origin:20px 10px;animation:sz-bat 150ms ease-in-out infinite alternate}
${VOLS.map(([w, duree, depart, aile], i) =>
  `      #scrutoir-saison .sz-c${i + 1}{width:${w}px;animation:sz-vol ${duree}ms ${EASE_IO} ${depart}ms forwards}\n` +
  `      #scrutoir-saison .sz-c${i + 1} .sz-aile{animation-duration:${aile}ms}`).join("\n")}
      #scrutoir-saison.sz-depart .sz-lune-wrap,#scrutoir-saison.sz-depart .sz-toile{opacity:0;transition:opacity ${MOTION.slow}ms ${EASE_IN}}
      #scrutoir-saison.sz-depart .sz-araignee{animation:sz-remonte ${MOTION.slow}ms ${EASE_IN} forwards}
      @keyframes sz-eclat{to{opacity:1;transform:none}}
      @keyframes sz-respire{from{opacity:1}to{opacity:.7}}
      @keyframes sz-trace{to{stroke-dashoffset:0}}
      @keyframes sz-descend{0%{transform:translateY(0)}75%{transform:translateY(136px)}100%{transform:translateY(128px)}}
      @keyframes sz-balance{from{transform:translateY(128px)}to{transform:translateY(136px)}}
      @keyframes sz-remonte{from{transform:translateY(128px)}to{transform:translateY(-30px)}}
      @keyframes sz-vol{from{opacity:1;offset-distance:0%}to{opacity:1;offset-distance:100%}}
      @keyframes sz-bat{from{transform:scaleY(1)}to{transform:scaleY(-.35)}}
      #scrutoir-saison .sz-couche{position:absolute;inset:0}
      #scrutoir-saison.sz-depart .sz-couche{opacity:0;transition:opacity 600ms ${EASE_IN}}
      #scrutoir-saison .sz-neige{position:absolute;inset:0;opacity:0;-webkit-mask-image:radial-gradient(ellipse 150px 165px at 50% calc(50% - 6px),transparent 62%,#000 100%);mask-image:radial-gradient(ellipse 150px 165px at 50% calc(50% - 6px),transparent 62%,#000 100%);animation:sz-apparait 900ms ${EASE_OUT} 100ms forwards}
      #scrutoir-saison .sz-flocon{position:absolute;top:-20px;animation:sz-tombe var(--d) linear var(--dl) infinite}
      #scrutoir-saison .sz-flocon i{display:block;width:var(--s);height:var(--s);border-radius:50%;background:var(--sz-neige);opacity:var(--o);box-shadow:0 0 0 .75px var(--sz-fil);animation:sz-derive var(--dd) ease-in-out infinite alternate}
      #scrutoir-saison .sz-cristal i{background:none;border-radius:0;box-shadow:none}
      #scrutoir-saison .sz-cristal svg{display:block;width:100%;height:100%;fill:none;stroke:var(--sz-neige);stroke-width:1.3;stroke-linecap:round;filter:drop-shadow(0 0 .7px var(--sz-fil));animation:sz-tourne 8s linear infinite}
      #scrutoir-saison .sz-feux{position:absolute;left:50%;top:50%;width:340px;height:740px;margin:-370px 0 0 -170px;overflow:visible}
      #scrutoir-saison .sz-fusee{fill:var(--sz-or);opacity:0;animation:sz-monte 520ms ${EASE_OUT} var(--t) forwards}
      #scrutoir-saison .sz-gerbe{opacity:0;transform-box:fill-box;transform-origin:center;stroke:var(--sz-or);stroke-width:1.6;stroke-linecap:round;fill:var(--sz-or);animation:sz-eclate 1300ms ${EASE_OUT} calc(var(--t) + 480ms) forwards}
      @keyframes sz-apparait{to{opacity:1}}
      @keyframes sz-tombe{from{transform:translateY(0)}to{transform:translateY(var(--chute))}}
      @keyframes sz-derive{from{transform:translateX(calc(var(--a) * -1))}to{transform:translateX(var(--a))}}
      @keyframes sz-tourne{to{transform:rotate(360deg)}}
      @keyframes sz-monte{0%{opacity:1;transform:translateY(var(--r))}85%{opacity:1}100%{opacity:0;transform:translateY(0)}}
      @keyframes sz-eclate{0%{opacity:1;transform:scale(.12)}45%{opacity:1}100%{opacity:0;transform:translateY(12px) scale(1)}}
      @media (prefers-reduced-motion:reduce){#scrutoir-saison{display:none}}
    </style>`;

/**
 * Script de la surcouche, juste après celui du splash (qui lit window.__scrutoirSaison au
 * moment de partir). Hors période ou id inconnu : ne fait rien.
 * DECORS : balisage (m), fin du décor en ms depuis l'ouverture (fin : la surcouche reste au
 * moins jusque-là après le départ du splash ; 0 = elle part avec lui), init éventuelle, et
 * sombre:1 pour forcer le splash sombre quel que soit le thème choisi.
 */
export const SAISON_SCRIPT = `
    <script>
      (function(){
        var PERIODES=${JSON.stringify(PERIODES)};
        var saisonActive=${saisonActive.toString()};
        var id=null;
        try{var q=new URLSearchParams(location.search).get("saison");id=q==="aucune"?null:(q||saisonActive(new Date(),PERIODES));}catch(e){}
        var DECORS={
          halloween:{m:${JSON.stringify(MARKUP_HALLOWEEN)},fin:5100,init:${INIT_HALLOWEEN}},
          neige:{m:${JSON.stringify(MARKUP_NEIGE)},fin:0,init:${INIT_NEIGE},sombre:1},
          minuit:{m:${JSON.stringify(MARKUP_MINUIT)},fin:0,sombre:1}
        };
        var d=id&&Object.prototype.hasOwnProperty.call(DECORS,id)?DECORS[id]:null;
        if(!d)return;
        try{if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;}catch(e){} // coupure totale
        var t0=Date.now(),parti=false,sombre=!!d.sombre; // sombre forcé par le décor, sinon thème de l'utilisateur
        if(!sombre)try{var pref=localStorage.getItem("scrutoir.scheme");sombre=pref==="dark"||(pref==="auto"&&!!window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);}catch(e){}
        var sp=document.getElementById("scrutoir-splash");
        if(sombre&&sp)sp.classList.add("ss-sombre"); // splash sombre pendant l'intro seulement
        var el=document.createElement("div");
        el.id="scrutoir-saison";el.setAttribute("aria-hidden","true");
        el.className="sz-"+id+(sombre?" sz-sombre":"");
        el.innerHTML=d.m;
        document.body.appendChild(el);
        if(d.init)d.init(el);
        function retirer(){if(el.parentNode)el.parentNode.removeChild(el);}
        window.__scrutoirSaison={
          tenue:${TENUE_MS},
          depart:function(){if(parti)return;parti=true;el.classList.add("sz-depart");setTimeout(retirer,Math.max(700,d.fin-(Date.now()-t0)));},
          stop:retirer
        };
      })();
    </script>`;
