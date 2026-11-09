// Image « story » (1080 × 1920) du spectre du test de proximité, dessinée 100 % dans le
// navigateur (canvas) puis partagée par la feuille de partage système (Web Share, fichiers).
// Instagram ne prend pas un lien en story : il lui faut une image. Rien n'est envoyé à un
// serveur, et l'image ne contient AUCUNE réponse : seulement le spectre complet (tous les
// groupes, avec leur base « sur N votes ») et la signature @scrutoir.fr.
//
// Neutralité : pas de titre « tu es proche de X ». L'ordre est celui de l'écran (moteur,
// % décroissant), les groupes sous le seuil de fiabilité restent visibles, en gris, sans %.
// Charte : toujours le thème CLAIR (objet de marque, identique quel que soit le thème de
// l'appareil), couleurs lues dans `LIGHT`, couleurs de groupe via couleurGroupePour(…, "light").
// Ligne du spectre = copie conforme de `LigneGroupe` (TestResultatScreen), agrandie ×K.
// Logo : géométrie officielle (`components/brand/geometrie.ts`), la même que les composants.

import { LIGHT, F, couleurGroupePour } from "../theme";
import { INSTAGRAM_HANDLE } from "../config";
import { surNVotes, type LigneSpectre } from "../testProximite/spectre";
import { geometrieMarque, LOGOTYPE } from "../components/brand/geometrie";

export interface LigneImage extends LigneSpectre {
  /** Hex officiel du groupe (partis.json). */
  couleur: string | null;
}

const W = 1080;
const H = 1920;
const MX = 90; // marge latérale
const HAUT = 250; // zone haute réservée par Instagram (barre de progression, avatar)
const BAS = 1920 - 260; // zone basse réservée (champ de réponse)
const K = 2.6; // échelle écran → image (ligne du spectre de l'app agrandie)

function lignesDe(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const mots = texte.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const m of mots) {
    const essai = cur ? `${cur} ${m}` : m;
    if (ctx.measureText(essai).width > largeur && cur) {
      out.push(cur);
      cur = m;
    } else cur = essai;
  }
  if (cur) out.push(cur);
  return out;
}

function rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Logo horizontal officiel (mêmes proportions que ScrutoirLogo), en thème clair. */
function dessinerLogo(ctx: CanvasRenderingContext2D, x: number, yCentre: number, wordHeight: number) {
  const g = geometrieMarque(wordHeight * 1.45);
  const top = yCentre - g.h / 2;
  for (const d of g.dots) {
    ctx.beginPath();
    ctx.arc(x + d.x, top + d.y, g.dotR, 0, Math.PI * 2);
    if (d.white) {
      ctx.fillStyle = "#FFFFFF"; // siège blanc : exception documentée de la charte
      ctx.fill();
      ctx.lineWidth = g.strokeW;
      ctx.strokeStyle = LIGHT.text;
      ctx.stroke();
    } else {
      ctx.fillStyle = LIGHT.text;
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(x + g.focal.x, top + g.focal.y, g.focal.r, 0, Math.PI * 2);
  ctx.fillStyle = LIGHT.accent;
  ctx.fill();

  const k = wordHeight / LOGOTYPE.VB_H;
  ctx.save();
  ctx.translate(x + g.w + wordHeight * 0.45, yCentre - wordHeight / 2);
  ctx.scale(k, k);
  ctx.save();
  ctx.translate(LOGOTYPE.tx, LOGOTYPE.ty);
  ctx.scale(LOGOTYPE.s, -LOGOTYPE.s);
  ctx.fillStyle = LIGHT.text;
  ctx.fill(new Path2D(LOGOTYPE.d));
  ctx.restore();
  ctx.beginPath();
  ctx.arc(LOGOTYPE.point.cx, LOGOTYPE.point.cy, LOGOTYPE.point.r, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF"; // point du i blanc : exception documentée de la charte
  ctx.fill();
  ctx.lineWidth = LOGOTYPE.point.strokeW;
  ctx.strokeStyle = LIGHT.text;
  ctx.stroke();
  ctx.restore();
}

/** Dessine l'image du spectre et la renvoie en PNG (null hors navigateur). */
export async function imageStorySpectre(lignes: LigneImage[], phraseBase: string): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Polices de l'app (déjà chargées par useFonts) : on attend qu'elles soient prêtes.
  try {
    await Promise.all([F.extra, F.bold, F.medium].map((f) => (document as any).fonts?.load?.(`40px ${f}`)));
  } catch {
    /* repli sur la police système */
  }

  ctx.fillStyle = LIGHT.bg;
  ctx.fillRect(0, 0, W, H);

  // Logo officiel (picto + logotype vectoriels)
  let y = HAUT;
  dessinerLogo(ctx, MX, y + 30, 60);
  y += 100;

  // Titre
  ctx.fillStyle = LIGHT.text;
  ctx.textBaseline = "alphabetic";
  ctx.font = `64px ${F.extra}`;
  for (const l of lignesDe(ctx, "Mon spectre au test de proximité", W - 2 * MX)) {
    y += 72;
    ctx.fillText(l, MX, y);
  }
  // Base de tout le résultat (même phrase que sous le titre de l'écran)
  ctx.fillStyle = LIGHT.textMuted;
  ctx.font = `32px ${F.medium}`;
  y += 14;
  for (const l of lignesDe(ctx, phraseBase, W - 2 * MX)) {
    y += 42;
    ctx.fillText(l, MX, y);
  }
  y += 40;

  // Carte du spectre : toutes les lignes, hauteur ajustée à l'espace restant
  const piedH = 140;
  const pad = 12;
  const n = Math.max(lignes.length, 1);
  const rowH = Math.max(72, Math.min(96, Math.floor((BAS - piedH - y - 2 * pad) / n)));
  const carteH = rowH * n + 2 * pad;
  const cx0 = MX - 24;
  const cw = W - 2 * MX + 48;
  ctx.fillStyle = LIGHT.surface;
  rectArrondi(ctx, cx0, y, cw, carteH, 18 * K); // RADIUS.lg
  ctx.fill();

  const xPastille = cx0 + 14 * K + 5 * K;
  const xNom = cx0 + 14 * K + 10 * K + 10 * K;
  const xBarre = xNom + 86 * K + 10 * K;
  const xFin = cx0 + cw - 16 * K;
  const largPct = 46 * K;
  let ry = y + pad;
  lignes.forEach((l, i) => {
    const cy = ry + rowH / 2;
    if (i > 0) {
      ctx.fillStyle = LIGHT.border;
      ctx.fillRect(cx0 + 38 * K, ry, cw - 38 * K, 2);
    }
    const fiable = l.pct != null;
    const couleur = couleurGroupePour(l.couleur, "light");
    ctx.fillStyle = fiable ? couleur : LIGHT.borderStrong;
    ctx.beginPath();
    ctx.arc(xPastille, cy, 5 * K, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fiable ? LIGHT.text : LIGHT.textFaint;
    // Sigle + « sur N votes » : bloc centré sur la ligne (même hauteur au-dessus et en dessous).
    ctx.font = `${15 * K}px ${F.bold}`;
    ctx.fillText(l.abrev, xNom, cy - 3);
    ctx.fillStyle = LIGHT.textFaint;
    ctx.font = `${11 * K}px ${F.medium}`;
    ctx.fillText(surNVotes(l.votes), xNom, cy + 10 * K + 3);
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    if (fiable) {
      const lb = xFin - largPct - xBarre - 8;
      ctx.fillStyle = LIGHT.surfaceSunken;
      rectArrondi(ctx, xBarre, cy - 4 * K, lb, 8 * K, 4 * K);
      ctx.fill();
      ctx.fillStyle = couleur;
      rectArrondi(ctx, xBarre, cy - 4 * K, Math.max(8 * K, lb * (l.pct ?? 0)), 8 * K, 4 * K);
      ctx.fill();
      ctx.fillStyle = LIGHT.text;
      ctx.font = `${15 * K}px ${F.extra}`;
      ctx.fillText(`${Math.round((l.pct ?? 0) * 100)} %`, xFin, cy);
    } else {
      const txt = "pas assez de votes";
      ctx.font = `${11 * K}px ${F.medium}`;
      ctx.fillStyle = LIGHT.textFaint;
      ctx.fillText(txt, xFin, cy);
      // Piste hachurée, comme PisteHachuree
      const lb = xFin - ctx.measureText(txt).width - 10 * K - xBarre;
      ctx.save();
      rectArrondi(ctx, xBarre, cy - 4 * K, lb, 8 * K, 4 * K);
      ctx.clip();
      ctx.fillStyle = LIGHT.surfaceSunken;
      ctx.fillRect(xBarre, cy - 4 * K, lb, 8 * K);
      ctx.fillStyle = LIGHT.borderStrong;
      for (let x = xBarre; x < xBarre + lb; x += 10 * K) ctx.fillRect(x, cy - 4 * K, 6 * K, 8 * K);
      ctx.restore();
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ry += rowH;
  });

  // Pied : l'invitation et la signature du compte
  let py = y + carteH + 76;
  ctx.fillStyle = LIGHT.text;
  ctx.font = `44px ${F.extra}`;
  ctx.fillText("Fais le test sur scrutoir.fr", MX, py);
  py += 54;
  ctx.fillStyle = LIGHT.textMuted;
  ctx.font = `34px ${F.medium}`;
  ctx.fillText(`${INSTAGRAM_HANDLE} sur Instagram`, MX, py);

  return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
}

export type ResultatPartageImage = "shared" | "downloaded" | "cancelled" | "manual";

/**
 * Partage l'image par la feuille système (où Instagram apparaît sur mobile). Sans partage
 * de fichiers (ordinateur, vieux navigateur), ou si le navigateur refuse le partage (geste
 * expiré : NotAllowedError), l'image est téléchargée. Fermer la feuille ne télécharge rien.
 */
export async function partagerImage(blob: Blob, nom = "scrutoir-spectre.png"): Promise<ResultatPartageImage> {
  try {
    const fichier = new File([blob], nom, { type: "image/png" });
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav?.canShare?.({ files: [fichier] })) {
      await nav.share({ files: [fichier] });
      return "shared";
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return "cancelled"; // l'utilisateur a fermé la feuille
  }
  try {
    if (typeof document !== "undefined") {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return "downloaded";
    }
  } catch {
    /* téléchargement impossible */
  }
  return "manual";
}
