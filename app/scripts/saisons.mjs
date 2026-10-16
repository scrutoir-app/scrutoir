/*
 * Calendrier des intros saisonnières du splash (charte scrutoir-design, « Animations
 * saisonnières »). Une période = un décor joué À L'OUVERTURE de l'appli, uniquement du
 * `debut` au `fin` inclus (« MM-JJ », heure locale de l'utilisateur, chaque année). Hors
 * période : aucun décor, le splash habituel.
 *
 * Planifier : ajouter / modifier une ligne de PERIODES. L'`id` doit avoir un décor dans
 * splash-saison.mjs (DECORS), sinon le build échoue. Une période peut chevaucher le
 * 1er janvier (`debut` > `fin`). Les dates sont fixes d'une année sur l'autre : elles ne
 * suivent pas le calendrier scolaire (à revoir chaque automne si besoin).
 *
 * Prévisualiser hors période : https://scrutoir.fr/?saison=halloween ; couper : ?saison=aucune.
 *
 * ⚠️ `saisonActive` est inlinée telle quelle dans le splash (toString) : JS autonome, ES5,
 * sans dépendance.
 */
export const PERIODES = [
  { id: "halloween", debut: "10-17", fin: "11-02" }, // ~2 semaines autour du 31 (décision du 2026-10-16)
  { id: "neige", debut: "12-19", fin: "12-31" },     // début des vacances de Noël → 31 déc. 23 h 59
  { id: "minuit", debut: "01-01", fin: "01-05" },    // 1er janv. 0 h → 5 janv. inclus
];

/** Id de la période qui contient `date` (heure locale), ou null. */
export function saisonActive(date, periodes) {
  var jour = (date.getMonth() + 1) * 100 + date.getDate(); // 26 octobre → 1026
  for (var i = 0; i < periodes.length; i++) {
    var p = periodes[i];
    var d = Number(p.debut.replace("-", "")), f = Number(p.fin.replace("-", ""));
    if (d <= f ? jour >= d && jour <= f : jour >= d || jour <= f) return p.id;
  }
  return null;
}
