/*
 * Version du service worker, posée au build à partir de APP_VERSION (src/config.ts).
 *
 * Le navigateur ne propose une nouvelle version de l'appli (bandeau « Mise à jour disponible »,
 * src/swUpdate.ts) que si le fichier sw.js CHANGE. Tant que SHELL_VERSION se bumpait à la main,
 * l'oubli passait inaperçu : de la 1.33.0 à la 1.35.0, sw.js est resté identique, aucun bandeau,
 * et une PWA installée reprise depuis l'arrière-plan gardait l'ancien bundle en mémoire.
 *
 * Ici, patch-pwa.mjs suffixe la base de public/sw.js (« v38 ») avec APP_VERSION dans dist/sw.js :
 * « v38-1.35.1 ». Chaque version publiée change donc sw.js (nouveau SW → bandeau), et le cache de
 * la coquille porte le numéro de version (l'ancien est purgé à l'activation, données et modèle
 * gardés). Le refresh quotidien, qui ne change pas APP_VERSION, ne fait pas apparaître de bandeau.
 * La base « vNN » ne se bumpe plus à la main que pour forcer une purge sans changer de version.
 */

const MOTIF = /const SHELL_VERSION = "(v\d+)(?:-[^"]*)?";/g;
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Renvoie le source de sw.js avec SHELL_VERSION = "<base>-<appVersion>". Idempotent. */
export function versionnerSw(source, appVersion) {
  if (!SEMVER.test(appVersion ?? "")) throw new Error(`[sw-version] APP_VERSION invalide : ${appVersion}`);
  const trouves = [...source.matchAll(MOTIF)];
  if (trouves.length !== 1) {
    throw new Error(`[sw-version] sw.js : ${trouves.length} déclaration(s) \`const SHELL_VERSION = "vNN";\` (1 attendue)`);
  }
  return source.replace(MOTIF, (_, base) => `const SHELL_VERSION = "${base}-${appVersion}";`);
}
