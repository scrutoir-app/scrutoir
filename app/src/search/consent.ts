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

/** Cache du SW qui contient le modèle (`scrutoir-model-*`, sans figer la version ici). */
function estCacheModeleSW(nom: string): boolean {
  return nom.startsWith("scrutoir-model-");
}

/**
 * Caches à vider pour supprimer le modèle : celui du SW, et `transformers-cache`, la copie
 * que transformers.js rangeait lui-même avant la 1.19.2 (`useBrowserCache`, coupé depuis
 * dans embedder.ts). Elle reste sur les appareils tant que le SW v36 n'est pas activé.
 */
function estCacheModele(nom: string): boolean {
  return estCacheModeleSW(nom) || nom === "transformers-cache";
}

/**
 * Le modèle est-il déjà en cache ? (opt-in implicite : plus rien à télécharger).
 * Seul le cache du SW compte : transformers.js ne lit plus `transformers-cache`, une copie
 * restée là ne dispense pas du téléchargement.
 */
export async function modeleDejaEnCache(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    for (const nom of await caches.keys()) {
      if (!estCacheModeleSW(nom)) continue;
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

/**
 * Retire l'opt-in : la section Sujet repasse au repli lexical et re-proposera « Activer ».
 * Purement local, rien n'est envoyé.
 */
export function revoquerSemantique(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(CLE_OPTIN);
  } catch {
    /* stockage indisponible : rien à retirer */
  }
}

/**
 * Supprime le modèle de l'appareil (Paramètres → « Sur cet appareil ») : révoque l'opt-in
 * PUIS vide les caches du modèle (sinon un modèle encore en cache vaudrait opt-in
 * implicite, cf. modeleDejaEnCache). Le modèle déjà chargé en mémoire reste utilisable
 * jusqu'au rechargement de la page, mais la recherche ne s'en sert plus (opt-in retiré).
 */
export async function supprimerModele(): Promise<void> {
  revoquerSemantique();
  try {
    if (typeof caches === "undefined") return;
    for (const nom of await caches.keys()) if (estCacheModele(nom)) await caches.delete(nom);
  } catch {
    /* Cache API indisponible : rien à purger */
  }
}
