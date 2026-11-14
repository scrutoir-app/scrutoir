#!/usr/bin/env node
/*
 * Génère la marque Scrutoir SUR FOND SOMBRE, contour citron (décision du 14/11/2026) :
 *  - exports de marque sombres dans brand/ (mark, wordmark, logo horizontal et vertical, SVG + PNG @1x/@2x/@3x) ;
 *  - icônes d'app : iOS (assets/icon.png), Android adaptative (foreground / background / monochrome),
 *    favicon (assets/favicon.png + public/favicon.ico 16/32/48), PWA (public/icons/*).
 *
 * Les versions CLAIRES (logo déposé à l'INPI n°5272135) ne sont jamais écrites ici.
 * Géométrie lue dans src/components/brand/geometrie.ts (source unique), couleurs dans theme.ts.
 *
 * Icônes : même composition que la photo de profil Instagram « sombre citron » : fond #161A20,
 * points et gros rond blancs, gros rond au CENTRE EXACT du carré, hémicycle à 57,45 % du côté,
 * contour citron du siège épaissi à size/64 (comme instagram/sources/common.py, mark()).
 *
 * Usage : node scripts/gen-marque-sombre.mjs [--sortie <dossier>]   (défaut : le dépôt lui-même)
 *         node scripts/gen-marque-sombre.mjs --sortie /tmp/apercu      (aperçu, ne touche à rien)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { geometrieMarque, LOGOTYPE } from "../src/components/brand/geometrie.ts";
import { DARK } from "../src/theme.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, "..");
const args = process.argv.slice(2);
const iSortie = args.indexOf("--sortie");
const RACINE = iSortie >= 0 ? args[iSortie + 1] : join(APP, ".."); // racine du dépôt

const CITRON = DARK.marqueContour; // #C8FF2E
const BLANC = "#FFFFFF"; // points, mot et gros rond en négatif (exception de marque documentée)
const FOND = "#161A20"; // fond de la photo de profil Instagram et des visuels sombres
// Échelle de la photo de profil : rayon extérieur 273 px sur 1080 → size = 620,5 / 1080.
const ECHELLE_PROFIL = 620.5 / 1080;

const f = (n) => Number(n.toFixed(2));

/** Picto en négatif. evide : remplissage du siège (null = transparent). trait : épaisseur du contour. */
function cerclesPicto(size, { ox = 0, oy = 0, evide = null, trait, contour = CITRON, encre = BLANC, focal = BLANC } = {}) {
  const g = geometrieMarque(size);
  const sw = trait ?? g.strokeW;
  const out = g.dots.map((d) =>
    d.white
      ? `<circle cx="${f(ox + d.x)}" cy="${f(oy + d.y)}" r="${f(g.dotR)}" fill="${evide ?? "none"}" stroke="${contour}" stroke-width="${f(sw)}"/>`
      : `<circle cx="${f(ox + d.x)}" cy="${f(oy + d.y)}" r="${f(g.dotR)}" fill="${encre}"/>`
  );
  out.push(`<circle cx="${f(ox + g.focal.x)}" cy="${f(oy + g.focal.y)}" r="${f(g.focal.r)}" fill="${focal}"/>`);
  return { svg: out.join(""), g };
}

/** Mot seul en négatif, dans le repère du viewBox LOGOTYPE, placé en (x, y) à la hauteur h. */
function mot(x, y, h, { evide = null, contour = CITRON, encre = BLANC } = {}) {
  const k = h / LOGOTYPE.VB_H;
  const p = LOGOTYPE.point;
  return (
    `<g transform="translate(${f(x)} ${f(y)}) scale(${k})">` +
    `<g transform="translate(${LOGOTYPE.tx} ${LOGOTYPE.ty}) scale(${LOGOTYPE.s} ${-LOGOTYPE.s})"><path d="${LOGOTYPE.d}" fill="${encre}"/></g>` +
    `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${evide ?? "none"}" stroke="${contour}" stroke-width="${p.strokeW}"/>` +
    `</g>`
  );
}

const svgDoc = (w, h, corps, fond, affiche = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w * affiche)}" height="${f(h * affiche)}">` +
  (fond ? `<rect width="100%" height="100%" fill="${fond}"/>` : "") +
  corps +
  `</svg>\n`;

// ---------- Exports de marque (fond transparent, siège et point évidés : on voit le fond sombre) ----------

function exportMark() {
  const size = 200; // même cadre que brand/scrutoir-mark.svg (200 × 144)
  const { svg, g } = cerclesPicto(size);
  return svgDoc(g.w, g.h, svg);
}

function exportWordmark() {
  const h = 64;
  const w = (h * LOGOTYPE.VB_W) / LOGOTYPE.VB_H;
  return svgDoc(w, h, mot(0, 0, h));
}

/** Lockups : mêmes proportions que ScrutoirLogo.tsx. */
function exportLogo(vertical) {
  const wordHeight = 64;
  const markSize = wordHeight * (vertical ? 3.0 : 1.45);
  const gap = wordHeight * (vertical ? 0.5 : 0.45);
  const g = geometrieMarque(markSize);
  const wordW = (wordHeight * LOGOTYPE.VB_W) / LOGOTYPE.VB_H;
  if (vertical) {
    const W = Math.max(g.w, wordW);
    const H = g.h + gap + wordHeight;
    const pic = cerclesPicto(markSize, { ox: (W - g.w) / 2 }).svg;
    return svgDoc(W, H, pic + mot((W - wordW) / 2, g.h + gap, wordHeight));
  }
  const W = g.w + gap + wordW;
  const H = Math.max(g.h, wordHeight);
  const pic = cerclesPicto(markSize, { oy: (H - g.h) / 2 }).svg;
  return svgDoc(W, H, pic + mot(g.w + gap, (H - wordHeight) / 2, wordHeight));
}

// ---------- Icônes (composition de la photo de profil) ----------

/**
 * Icône carrée N px : gros rond au centre exact, échelle `echelle` × côté. fond null = transparent.
 * Dessinée dans un cadre de 1080 (celui de la photo de profil) puis affichée à N px : la géométrie reste
 * proportionnelle (pas de plancher à 1 px des rayons, qui grossirait les sièges en petit).
 */
const CADRE = 1080;
function icone(N, { echelle = ECHELLE_PROFIL, fond = FOND, evide = FOND, contour = CITRON, encre = BLANC } = {}) {
  const size = echelle * CADRE;
  const g = geometrieMarque(size);
  const ox = CADRE / 2 - g.focal.x;
  const oy = CADRE / 2 - g.focal.y;
  const { svg } = cerclesPicto(size, { ox, oy, evide, trait: size / 64, contour, encre, focal: encre });
  return svgDoc(CADRE, CADRE, svg, fond, N / CADRE);
}

/** Distance max du centre du cadre au bord de l'hémicycle, en fraction du côté (contrôle zone de sécurité). */
function rayonOccupe(echelle) {
  const s = echelle * CADRE;
  const g = geometrieMarque(s);
  const cx = g.focal.x, cy = g.focal.y;
  return Math.max(...g.dots.map((d) => Math.hypot(d.x - cx, d.y - cy) + g.dotR + s / 128)) / CADRE;
}

async function pngTaille(svg, largeur) {
  // densité calée pour rendre le SVG vectoriellement à la taille voulue (pas de rééchantillonnage d'un raster)
  const meta = await sharp(Buffer.from(svg)).metadata();
  const density = (72 * largeur) / meta.width;
  return sharp(Buffer.from(svg), { density }).resize(largeur, null, { kernel: "lanczos3" }).png({ compressionLevel: 9 }).toBuffer();
}

/** ICO multi-tailles à entrées PNG (lu par tous les navigateurs actuels). */
function ico(pngs) {
  const n = pngs.length;
  const head = Buffer.alloc(6 + 16 * n);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(n, 4);
  let off = head.length;
  pngs.forEach(({ taille, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(taille >= 256 ? 0 : taille, e);
    head.writeUInt8(taille >= 256 ? 0 : taille, e + 1);
    head.writeUInt8(0, e + 2);
    head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

async function ecrire(rel, contenu) {
  const p = join(RACINE, rel);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, contenu);
  console.log("  ", rel);
}

// Échelle des favicons ≤ 48 px : la composition de la photo de profil (57 %) y devient une tache ;
// on agrandit l'hémicycle à 92 % du côté, gros rond toujours au centre exact (option C, choisie par
// Anthony le 14/11/2026 sur rendu à taille réelle 16/32/48 px).
const ECHELLE_FAVICON = 0.92;

async function main() {
  console.log(`[gen-marque-sombre] sortie : ${RACINE}`);
  const ro = rayonOccupe(ECHELLE_PROFIL);
  const safeAndroid = 66 / 108 / 2; // cercle de sécurité de l'icône adaptative (66 dp sur 108 dp)
  console.log(`  hémicycle : rayon occupé ${(ro * 100).toFixed(1)} % du côté ; sécurité Android ${(safeAndroid * 100).toFixed(1)} % ; maskable PWA 40 %`);
  if (ro > safeAndroid || ro > 0.4) throw new Error("L'hémicycle sort de la zone de sécurité : réduire l'échelle.");

  // 1. Exports de marque sombres (brand/), à côté des versions claires, jamais à leur place.
  const exports = {
    "scrutoir-mark-sombre-citron": exportMark(),
    "scrutoir-wordmark-sombre-citron": exportWordmark(),
    "scrutoir-logo-horizontal-sombre-citron": exportLogo(false),
    "scrutoir-logo-vertical-sombre-citron": exportLogo(true),
  };
  for (const [nom, svg] of Object.entries(exports)) {
    await ecrire(`brand/${nom}.svg`, svg);
    const meta = await sharp(Buffer.from(svg)).metadata();
    for (const k of [1, 2, 3]) await ecrire(`brand/${nom}${k > 1 ? `@${k}x` : ""}.png`, await pngTaille(svg, meta.width * k));
  }

  // 2. Icônes d'app (Expo) : iOS sans transparence, Android adaptative.
  await ecrire("app/assets/icon.png", await pngTaille(icone(1024), 1024));
  await ecrire("app/assets/android-icon-background.png", await pngTaille(svgDoc(1024, 1024, "", FOND), 1024));
  await ecrire("app/assets/android-icon-foreground.png", await pngTaille(icone(1024, { fond: null, evide: FOND }), 1024));
  // Monochrome (icônes à thème d'Android 13+) : seule la silhouette compte ; le siège reste un anneau.
  await ecrire("app/assets/android-icon-monochrome.png", await pngTaille(icone(1024, { fond: null, evide: null, contour: BLANC }), 1024));

  // 3. Favicon : assets/favicon.png (repli Expo) + public/favicon.ico (prioritaire à l'export web).
  await ecrire("app/assets/favicon.png", await pngTaille(icone(256), 256));
  const tailles = [16, 32, 48];
  const pngs = [];
  for (const t of tailles) pngs.push({ taille: t, buf: await pngTaille(icone(t, { echelle: ECHELLE_FAVICON }), t) });
  await ecrire("app/public/favicon.ico", ico(pngs));

  // 4. PWA : any + maskable (le fond plein déborde, l'hémicycle tient dans le cercle de 80 %).
  await ecrire("app/public/icons/apple-touch-icon.png", await pngTaille(icone(180), 180));
  for (const t of [192, 512]) {
    const buf = await pngTaille(icone(t), t);
    await ecrire(`app/public/icons/icon-${t}.png`, buf);
    await ecrire(`app/public/icons/maskable-${t}.png`, buf);
  }
}

export { icone, exportLogo, exportMark, exportWordmark, rayonOccupe, ECHELLE_PROFIL, FOND };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
