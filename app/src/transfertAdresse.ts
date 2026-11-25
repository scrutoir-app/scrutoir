import { track } from "./analytics";
import { importerTransfert, lireHashTransfert } from "./testProximite/transfert";

/**
 * Ouverture d'un lien de transfert (`#transfert=…`), par exemple le lien de « Copier et
 * installer » collé dans Safari : les réponses sont importées sur l'appareil, puis le hash est
 * retiré de l'adresse (`history.replaceState`) pour ne pas être rejoué au rechargement ni repris
 * par un partage de la page. Le code ne quitte jamais l'appareil : il vit dans le hash, que le
 * navigateur n'envoie pas au serveur, et la mesure ne compte que le mode et l'issue.
 *
 * Appelé au démarrage (index.ts), APRÈS `demarrerMesure` (qui lit le hash pour l'écran d'arrivée)
 * et AVANT le premier rendu (l'onboarding voit les réponses importées).
 */
let importe = false;

export function importerTransfertDeLAdresse(): void {
  try {
    if (typeof window === "undefined" || !window.location?.hash?.includes("transfert=")) return;
    const d = lireHashTransfert();
    track("transfert_colle", "lien", d ? "transfert" : "rien");
    if (d && importerTransfert(d)) importe = true;
    window.history?.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  } catch {
    /* jamais bloquant */
  }
}

/** Des réponses viennent d'être importées depuis l'adresse : l'appli ouvre le résultat. */
export function transfertImporte(): boolean {
  return importe;
}
