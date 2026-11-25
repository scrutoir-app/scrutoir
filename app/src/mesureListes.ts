/**
 * Listes FERMÉES de la mesure d'audience : partages et provenance des visites.
 *
 * Seules ces valeurs quittent l'appareil, jamais une valeur libre (pas d'URL d'origine, pas de
 * contenu partagé, rien sur le résultat du test). Le Worker (`analytics/src/collecte.ts`)
 * importe ce même fichier et ramène toute valeur hors liste à « autre ».
 *
 * Module pur, sans import : le Worker l'embarque tel quel. Un nouvel endroit de partage, une
 * nouvelle entrée ou une nouvelle source = une valeur ajoutée ici, et nulle part ailleurs.
 */

/** Ce qui est partagé : `track("share", quoi, issue)`. */
export const QUOI_PARTAGE = ["spectre_story", "test_lien", "scrutin", "depute", "parti", "mesure"] as const;
export type QuoiPartage = (typeof QUOI_PARTAGE)[number];

/** Issue d'un partage : feuille système, copie, téléchargement (image), fermé, impossible. */
export const ISSUES_PARTAGE = ["shared", "copied", "downloaded", "cancelled", "manual"] as const;
export type IssuePartage = (typeof ISSUES_PARTAGE)[number];

/** Issues où le contenu est bien parti de l'appareil (comptées comme partages réussis). */
export const ISSUES_REUSSIES: readonly IssuePartage[] = ["shared", "copied", "downloaded"];

/** Résultats partagés du test : l'image du spectre en story, ou le lien du résultat. */
export const QUOI_SPECTRE: readonly QuoiPartage[] = ["spectre_story", "test_lien"];

/** Écran d'arrivée d'une visite : `track("arrivee", entree, source)`. */
export const ENTREES = ["accueil", "test", "scrutin", "depute", "parti", "presidentielle", "autre"] as const;
export type Entree = (typeof ENTREES)[number];

/** Valeurs de `?source=` posées sur nos liens Instagram (bio, story, publication). */
export const SOURCES_INSTAGRAM = ["insta_bio", "insta_story", "insta_post"] as const;

/** Catégorie du référent, déduite du seul nom de domaine (jamais l'adresse complète). */
export const REFERENTS = [
  "instagram", "facebook", "threads", "x", "linkedin", "google", "bing",
  "pages_seo", // nos propres pages statiques (scrutoir.fr/depute/…), CTA vers l'appli
  "autre_site",
] as const;
export type Referent = (typeof REFERENTS)[number];

/** Provenance d'une visite, première règle qui s'applique (cf. `choisirSource`, arrivee.ts). */
export const SOURCES = [
  "partage",
  "transfert", // lien « Copier et installer » (`?via=transfert#transfert=…`), ouvert dans un navigateur
  ...SOURCES_INSTAGRAM,
  "pwa",
  "autre_lien", // ?source= avec une valeur hors liste : jamais transmise telle quelle
  ...REFERENTS,
  "direct",
] as const;
export type Source = (typeof SOURCES)[number];

/**
 * Contexte d'arrivée (`contexteArrivee`, pwa.ts) : app installée, navigateur intégré (Instagram…)
 * sur iPhone ou Android, iPhone, Android avec ou sans invite d'installation, ordinateur. Jamais
 * l'user agent. `track("contexte", contexte, source)`, une fois par visite.
 */
export const CONTEXTES = [
  "installee",
  "integre-ios",
  "integre-android",
  "ios",
  "android-installable",
  "android",
  "ordinateur",
] as const;
export type Contexte = (typeof CONTEXTES)[number];

/** Où a lieu un geste d'installation ou de transfert : écran d'arrivée, bandeau de l'Accueil, écran du résultat. */
export const LIEUX_INSTALL = ["arrivee", "bandeau", "resultat"] as const;
export type LieuInstall = (typeof LIEUX_INSTALL)[number];

/** Issue de « Copier et installer » (`transfert_copie`) : copié, ou lien montré pour une copie à la main. */
export const ISSUES_COPIE = ["copied", "manual"] as const;
export type IssueCopie = (typeof ISSUES_COPIE)[number];

/** Comment arrive un transfert (`transfert_colle`, entité) : presse-papiers, champ à remplir, lien ouvert. */
export const MODES_COLLE = ["presse_papiers", "champ", "lien"] as const;
export type ModeColle = (typeof MODES_COLLE)[number];

/** Ce qui a été trouvé (`transfert_colle`, extra) : un transfert, un lien de résultat, rien, lecture refusée. */
export const ISSUES_COLLE = ["transfert", "test", "rien", "refuse"] as const;
export type IssueColle = (typeof ISSUES_COLLE)[number];

/** Classe d'appareil (largeur de viewport), cf. `deviceClass` dans analytics.ts. */
export const APPAREILS = ["mobile", "tablet", "desktop"] as const;
