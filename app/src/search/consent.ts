/**
 * Consentement au téléchargement du modèle sémantique (~120 Mo).
 *
 * La recherche « Sujet » repose sur un modèle d'embeddings téléchargé une seule fois.
 * On ne déclenche JAMAIS ce téléchargement à l'insu de l'utilisateur (forfait mobile !) :
 * tant qu'il n'a pas activé la fonction, la section Sujet se contente du repli lexical
 * et propose une carte « Activer » (voir SearchResultsList). L'opt-in est mémorisé en
 * localStorage ; un modèle déjà présent en cache vaut opt-in (rien à télécharger).
 */

const CLE_OPTIN = "scrutoir.semantique.optin";

/** L'utilisateur a-t-il déjà accepté le téléchargement du modèle ? */
export function semantiqueAutorisee(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CLE_OPTIN) === "1";
  } catch {
    return false;
  }
}

/**
 * Enregistre l'opt-in et demande la PERSISTANCE du storage : sans elle, iOS/Chrome
 * peuvent évincer le cache sous pression (iOS : purge après 7 jours sans visite) et
 * l'utilisateur re-téléchargerait les ~120 Mo en silence. Best-effort, sans prompt
 * bloquant : un refus n'empêche pas la fonctionnalité.
 */
export async function autoriserSemantique(): Promise<void> {
  try {
    localStorage.setItem(CLE_OPTIN, "1");
  } catch {
    /* stockage indisponible : l'opt-in vaudra pour la session */
  }
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* non supporté : tant pis */
  }
}

/**
 * Le modèle est-il déjà assemblé dans le cache du SW ? (opt-in implicite : plus rien
 * à télécharger). On balaie les caches `scrutoir-model-*` sans figer la version ici.
 */
export async function modeleDejaEnCache(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    for (const nom of await caches.keys()) {
      if (!nom.startsWith("scrutoir-model-")) continue;
      const cles = await (await caches.open(nom)).keys();
      if (cles.some((r) => r.url.endsWith("/model_quantized.onnx"))) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Y a-t-il la place pour le modèle ? (~120 Mo en cache + pic d'assemblage). Sans
 * estimation disponible, on tente — le SW échoue proprement et le repli lexical reste.
 */
export async function stockageSuffisant(): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est || est.quota == null || est.usage == null) return true;
    return est.quota - est.usage > 300 * 1024 * 1024;
  } catch {
    return true;
  }
}
