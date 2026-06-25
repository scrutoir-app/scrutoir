# Journal des versions — Scrutoir

Versionnage [semver](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.
La version est affichée en bas de l'écran **Infos** de l'app (à citer avec les retours utilisateurs).

> Procédure de release : incrémenter `APP_VERSION` dans `app/src/config.ts`, ajouter une
> entrée ici, puis déployer (`npm run build:web` + `wrangler pages deploy`). Bumper aussi
> `SHELL_VERSION` dans `app/public/sw.js` si on veut forcer le rafraîchissement de la coquille.

## 1.0.66 — 2026-06-25
- **Analytics (interne)** : mesure d'engagement **anonyme** du test de proximité — `test_start` /
  `test_done` avec le thème (ou « complet »), **jamais** les réponses ni le parti compatible (opinion
  politique = donnée sensible, conforme à la promesse « ne pas profiler »). Correction : l'event
  `shuffle` (bouton « Laissez-vous surprendre ») était émis par l'app mais rejeté par le Worker
  (absent de `EVENTS`) → désormais enregistré, avec l'angle du tirage. Aucun changement visible.

## 1.0.65 — 2026-06-25
- **Guide « Installer sur iPhone ou iPad »** : sur iOS, le bandeau d'installation (bas de l'accueil)
  devient « Voir comment faire » et ouvre un **guide illustré en 4 étapes** — barre d'adresse « ••• » →
  « Partager » → « Sur l'écran d'accueil » → « Ajouter » (Apple n'autorisant aucun ajout automatique).
  Réservé à iOS ; Android conserve le bouton « Installer » natif. Le bandeau disparaît une fois l'app
  installée (mode standalone). Nouveau composant `InstallGuide.tsx`.

## 1.0.64 — 2026-06-25
- **Carte de scrutin unifiée partout** : les listes de scrutins (Thème, votes d'un député par
  thème / par position, votes d'un groupe) adoptent la **même carte** que les Grands scrutins —
  picto + résultat + date + titre + **barre de vote et décompte Pour/Contre/Abstention**. Avant,
  ces listes affichaient une ligne dense sans la répartition des voix. Meilleure lisibilité et
  cohérence d'un écran à l'autre. Chaque page garde ses filtres propres (résultat, dates, etc.).
- Les rendus spécifiques sont conservés tels quels : confrontation de deux élus (votes A↔B) et
  cartes par thème de la fiche député (cases Pour/Contre du député).
- Technique : l'index `scrutins.json` porte désormais `pour/contre/abstention` (≈ +40 Ko gzip) ;
  composant unique `ScrutinCard` (l'ancien `ScrutinRow` est supprimé).

## 1.0.63 — 2026-06-25
- **Sécurité & robustesse** (durcissement, sans changement visible).
  - **Dashboard analytics** (Worker privé) : correction d'une XSS stockée (l'échappement
    HTML ignorait les guillemets, et le texte de recherche — entrée non fiable — atterrissait
    dans un attribut `title`) ; ajout d'une **CSP stricte** sur la réponse `/stats` (filet en
    défense en profondeur, aucun script ne peut s'exécuter) ; requêtes SQL : whitelist du type
    d'événement avant interpolation ; comparaison du mot de passe à **temps constant**.
  - **Pré-rendu SEO** : sérialisation JSON-LD durcie (`<`, `>`, `&` et séparateurs de ligne
    Unicode échappés) — un titre/nom contenant `</script>` ne peut plus casser la page.
  - **Test de proximité** : `decoderPartage` valide désormais le lien partagé (ids entiers,
    codes de réponse connus, poids numériques bornés) — un lien trafiqué ne peut plus injecter
    de valeur absurde dans le calcul.
  - **Déploiement** : nouveau garde `npm run check:data` / `npm run deploy:pages` qui **refuse
    un déploiement manuel** si la base locale est plus ancienne/pauvre que la prod (évite la
    régression de données déjà rencontrée).

## 1.0.62 — 2026-06-24
- **Test de proximité** : nouvelle fonctionnalité. Réponds à de vrais scrutins clivants (Pour /
  Sans avis / Contre) et découvre ta proximité avec chaque groupe — un **spectre**, jamais un parti
  unique. Entrées : carte d'accueil mise en avant « Et toi, tu votes comment ? », bouton par thème,
  bouton sur une fiche parti. Déroulé question par question avec dévoilement « Comment l'Assemblée
  a voté » (barre divergente + phrase d'alignement + lien source). Résultat : classement global
  (hémicycle par groupe + barres), **matrice thème × groupe**, pondération par thème recalculée en
  direct.
- **100 % privé** : les réponses (opinion politique, donnée sensible) ne sont **ni envoyées ni
  stockées côté serveur** — calcul sur l'appareil, dernier résultat gardé en local, partage par lien
  qui encode les réponses dans l'URL et recalcule à l'ouverture.
- **Animation d'accueil du test** : un « ? » dessiné par les sièges de l'hémicycle (coupole colorée
  par groupe + queue), composant `IntroQuestionMark`.
- **Blocage par thème** : un test mono-thème n'est proposé qu'au-delà de 7 scrutins validés
  (auto-déblocage dès que la donnée le permet) ; le test complet reste toujours accessible.
- **Accueil réordonné** : grands scrutins → test → mon député → confronter → thèmes. L'emphase
  (carte sombre) passe de « Confronter deux élus » à « Et toi, tu votes comment ? ».
- Données : `npm run build-test-data` (pipeline) compile les questions validées + totaux réels en
  `data/test-proximite.json`. Page Infos enrichie (test, confidentialité).

## 1.0.61 — 2026-06-24
- **Barre divergente — décompte des voix animé** : sur la carte « hero », la barre passe en
  style capsules (3 capsules indépendantes posées sur une piste, léger jour autour de
  l'abstention). Au-dessus, « écart de N voix » ; en dessous, le décompte « N pour / N abst. /
  N contre ». Les nombres s'incrémentent de 0 à leur valeur en synchro avec le remplissage
  (~1,9 s, même easing), rejoués à chaque affichage de carte.
- **Pictogramme hémicycle sur la liste des Partis** : la pastille de couleur est remplacée par
  un mini-hémicycle (géométrie du logo Scrutoir) qui situe le groupe sur l'axe gauche-droite
  (LFI à gauche, RN à droite…). Nouveau composant `HemicyclePicto`. Placement par position
  politique avec garantie d'au moins un siège visible par groupe ; NI et hors-liste en gris.
- **Liste des Partis : suppression du doublon « N élus »** sous le sigle (déjà affiché en gros à droite).

## 1.0.60 — 2026-06-24
- **Barre divergente à abstention centrée** sur la carte « hero » des derniers grands scrutins :
  le pour part vers la gauche, le contre vers la droite, l'abstention occupe le centre à cheval
  sur l'axe (largeur bornée à 30 %). Échelle = demi-hémicycle (577/2), donc une barre courte sur
  piste longue signale une faible participation. Légende 3 colonnes sous la barre
  (pour / abstention / contre). Nouveau composant `VoteBarDivergenteCentree` (les listes gardent
  `BarreDivergente`). Les trois segments s'ouvrent ensemble depuis le centre (~1,9 s, cubic-out),
  rejoués à chaque fois qu'une carte du carrousel est affichée ; reduce-motion respecté.
- **Filigrane des cartes allégé** (espacement des « sièges » 22 → 38) : fond moins chargé, plus lisible.
- Nouveau bloc « Lecture de la barre de vote » dans l'écran Infos.

## 1.0.59 — 2026-06-24
- **Page Thèmes triée par nombre de scrutins décroissant** : les thèmes les plus actifs
  apparaissent en premier (Économie 2914, Santé 1514, Sécurité & Justice 987…), cohérent
  avec le tri déjà appliqué à la grille de l'accueil depuis la v1.0.55.

## 1.0.58 — 2026-06-24
- **Ordre de lecture de la page Confrontation** : le texte « Choisissez deux élus pour comparer
  leurs votes. » est désormais affiché au-dessus des boîtes de sélection (et non plus après le
  shuffle). Séparateur léger entre les sélecteurs et la zone shuffle pour distinguer visuellement
  les deux modes d'entrée (manuel vs. tirage).

## 1.0.57 — 2026-06-24
- **Shuffle confrontation** : bouton « Laissez-vous surprendre » sous les sélecteurs de la page
  Confrontation. Trois angles pré-calculés dans le pipeline : `fracture_interne` (même groupe,
  votes les plus éloignés), `alliance_contre_nature` (groupes opposés, votes étonnamment proches),
  `faux_duel` (autour de 50 % d'accord). Bannière « Pourquoi ce duel » au-dessus de la synthèse.
  Architecture entièrement statique : pipeline → SQLite `confrontation_shuffle` → JSON
  `confrontation_shuffle.json` → lecture client-side. NI exclus des viviers ; calcul restreint aux
  scrutins classés dans un thème (cohérence avec `confrontation()`).
- **Barre sticky des deux élus** : composant `DuelDeputesBar` (avatar + nom + groupe, gauche/droite
  en miroir). Sur `ConfrontationScreen` : apparaît animée au scroll avec le taux d'accord au centre.
  Sur `ConfrontationListeScreen` : barre fixe en haut avec le thème et le taux de désaccord/accord.
- **Votes A gauche, B droite dans les listes de scrutins** : le vote du premier élu s'affiche à
  gauche et celui du second à droite (date au centre), en miroir de la barre sticky.

## 1.0.56 — 2026-06-23
- **Baseline d'accueil** : « Scrutins publics nominatifs · 17ᵉ législature » → **« Comment votent
  vraiment vos élus »** (accroche plus claire et orientée usage). La nuance « scrutins publics
  nominatifs » reste détaillée dans l'onglet Infos.

## 1.0.55 — 2026-06-23
- **Accueil « Explorer par thème » trié par nombre de scrutins décroissant** : la vedette et la
  pellicule suivent désormais l'activité réelle de l'Assemblée par thème (ordre neutre, sans
  jugement). Bascule alphabétique triviale (commentaire dans `ThemePicker.tsx`).

## 1.0.54 — 2026-06-23
- **Avatars des groupes : logos officiels (opt-in)** — nouveau réglage *Paramètres → Avatars des
  groupes* (« Sigles » par défaut / « Logos officiels »). Les logos des 12 groupes (servis depuis
  `/logos/partis/`) s'affichent dans « Mes suivis » et les puces « Partis suivis » quand l'utilisateur
  l'active ; sinon sigles lisibles (comportement inchangé). Préférence locale à l'appareil.
- **Forme = type d'entité suivie** : un **groupe** s'affiche en **carré arrondi** (comme les thèmes),
  un **député** reste **rond** → on distingue d'un coup d'œil un groupe suivi d'un élu suivi.
- Logos posés sur fond clair neutre → lisibles en thème clair comme sombre ; fallback monogramme
  (sigle) si pas de logo (ex. NI).

## 1.0.53 — 2026-06-23
- **Filtre Adopté / Rejeté sur les listes de scrutins** : en plus du filtre par année/mois, on
  peut désormais filtrer par résultat (« Adoptés » / « Rejetés »). Ajouté au composant partagé
  `ScrutinDateFilter`, il apparaît automatiquement sur toutes les listes où il y a un mélange
  (thème, votes d'un parti, confrontation, grands scrutins, votes d'un député) et reste masqué
  quand c'est inutile. « Rejeté » = tout ce qui n'est pas « adopté » (même règle que le badge).

## 1.0.52 — 2026-06-23
- **Correctif : zoom iOS au focus du champ de recherche** (régression du 1.0.51). Les champs de
  saisie étaient passés à 15px ; en dessous de 16px, iOS Safari zoome automatiquement au focus.
  Nouveau token `inputText` (16px, dans `theme.ts`) appliqué à tous les `TextInput` (recherche
  accueil + onglets, confrontation, « trouver mon député »).

## 1.0.51 — 2026-06-23
- **Échelle typographique unifiée** : remplacement des ~26 tailles de police codées à la main
  par **5 tailles** (11 · 13 · 15 · 18 · 22, écarts ~1.2) centralisées dans `app/src/theme.ts`
  (objet `T` + `tnum` pour les chiffres tabulaires). Tous les écrans migrés ; alignement
  colonne par colonne des compteurs (votes, %, scrutins). `callout` = coupe semi-bold de `body`
  (15px) pour les sous-titres, pas une taille de plus. Aucun changement de hiérarchie (un titre
  reste un titre) ; titre du hero d'accueil et vedette des thèmes calmés.

## 1.0.50 — 2026-06-23
- **SEO — couverture complète (lots 4 & 6)** : le pré-rendu (`prerender-seo.mjs`) couvre
  désormais **les 7 422 scrutins** (`/scrutin/<numero>/`, plus seulement les 75 « grands ») et
  génère des pages **député × thème** (`/depute/<slug>/<theme>/`) listant le détail scrutin par
  scrutin du député, avec écart à la consigne du groupe. Deux garde-fous : qualité (≥ 10 votes
  exprimés) **et** budget de fichiers — Cloudflare Pages plafonne à **20 000 fichiers/déploiement**,
  donc on se limite aux **3 thèmes les plus actifs par député** (1 720 pages ; ~18 400 fichiers au
  total, marge ~1 600). Les lignes « votes par thème » de la fiche pointent vers ces pages (top 3)
  ou vers le thème global. Sitemap : **9 748 URLs**. Le build échoue désormais tôt avec un message
  clair si on approche la limite Pages.

## 1.0.49 — 2026-06-23
- **SEO — pré-rendu des pages de contenu (lot 2)** : 681 vraies pages HTML statiques générées
  au build (`app/scripts/prerender-seo.mjs`) depuis les JSON : **577 députés** (`/depute/<slug>/`),
  **12 thèmes** (`/theme/<id>/`), **12 partis** (`/parti/<slug>/`), **75 grands scrutins**
  (`/scrutin/<numero>/`) + 4 hubs crawlables (`/deputes/`, `/themes/`, `/partis/`, `/scrutins/`).
  Contenu réel et unique, `<title>`/`description` uniques, canonical, Open Graph, **JSON-LD**
  (Person / Organization / CollectionPage / Article + BreadcrumbList) et **maillage interne**
  complet. Ces fichiers priment sur le catch-all `_redirects` ; ajout de fallbacks 404 sur les
  namespaces pour éviter les soft-404. Sitemap étendu à 681 URLs. Neutralité respectée (couleur
  seulement sur les votes). Voir `docs/seo-audit.md`.

## 1.0.48 — 2026-06-23
- **SEO — fondations de crawl (lot 1)** : ajout de `robots.txt` (autorise tout + référence le
  sitemap), génération de `sitemap.xml` au build (`patch-pwa.mjs`, `lastmod` issu de
  `version.json`), et balise `<link rel="canonical">` vers l'apex `scrutoir.fr` (l'apex et le
  `www` servaient tous deux un 200 → contenu dupliqué). Socle pour le pré-rendu des pages par
  contenu (lot 2). Voir `docs/seo-audit.md`.
  ⚠️ Reste à poser côté Cloudflare : redirection **301 `www` → apex** (Redirect Rule dashboard).

## 1.0.47 — 2026-06-23
- **Splash d'ouverture aligné sur le nouveau logo** : l'animation de chargement (hémicycle
  dont les sièges s'allument) reprend le **siège blanc contour encre** et le **logotype
  vectorisé** avec point du « i » blanc — au lieu de l'ancien picto monochrome + mot en
  police système. Cohérent avec le masthead de l'app. Voir `app/scripts/patch-pwa.mjs`.

## 1.0.46 — 2026-06-23
- **Nouveau logo Scrutoir** : picto hémicycle redessiné (siège blanc contour encre, jumeau
  du point du « i ») + logotype vectorisé (Manrope ExtraBold, indépendant du chargement de
  la police), réunis dans un lockup `ScrutoirLogo` (`app/src/components/brand/`). Affiché
  dans le masthead de l'Accueil.
- **En-têtes d'onglets cohérents** : sur Thèmes, Partis, Suivis et Infos, le titre et sa
  baseline sont désormais **fixes** (extraits du `ScrollView`) — même traitement que le
  masthead Accueil ; ils ne défilent plus avec le contenu.
- **Barre de recherche unifiée** : la barre des onglets reprend le design exact de l'Accueil
  (carré accent + loupe blanche, hauteur 54) au lieu de l'ancienne loupe grise simple.

## 1.0.45 — 2026-06-23
- **Mode sombre** : nouveau réglage d'apparence **Clair / Sombre / Auto** (« Auto » suit le
  système). Accessible via l'icône **⚙️ en haut de l'Accueil → écran Paramètres**. Le choix
  est mémorisé. Palette sombre cohérente (couleurs de vote relevées, pictos de thème adaptés) ;
  la couleur n'encode toujours que le vote.

## 1.0.44 — 2026-06-22
- **Hero d'accueil « signature »** : refonte du carrousel des derniers grands scrutins.
  Fond blanc sobre + **filigrane hémicycle** (motif Scrutoir) à la place de la photo ;
  **barre de vote et compteurs animés** (0 → valeur, respecte reduce-motion) ; navigation
  flèches + points ; **indicateur de fraîcheur** « Mis à jour le {date} · En direct »
  basé sur la vraie date de régénération des données (`version.json`).

## 1.0.43 — 2026-06-22
- **Confrontation — contexte du duel conservé** : en ouvrant la liste détaillée des accords/
  désaccords puis en revenant en arrière, les **2 élus sélectionnés** (et la période) sont
  restaurés au lieu de repartir d'une page vide. La sélection est persistée dans la route.

## 1.0.42 — 2026-06-22
- **Fiche parti — positions par thème en barre divergente** : Pour part du centre vers la
  gauche, Contre vers la droite (part relative aux exprimés), axe central aligné d'un thème
  à l'autre. Lecture immédiate de l'orientation du groupe.
- **Confrontation de deux élus** : par thème, **barre divergente accords / désaccords** (même
  langage visuel que la fiche parti), triée du plus divergent au plus convergent. Au dépli,
  deux boutons **Accord / Désaccord** (style Pour/Contre) ouvrent une **page dédiée** listant
  les scrutins, avec **filtres année/mois**.

## 1.0.41 — 2026-06-22
- Recherche : placeholder « Recherche député, parti, loi… » (Accueil + onglets).

## 1.0.40 — 2026-06-22
- Recherche depuis les onglets : on **tape directement dans la barre** (résultats en
  ligne), au lieu d'ouvrir une page séparée. Croix pour effacer.

## 1.0.39 — 2026-06-22
- **Recherche accessible depuis tous les onglets** : une barre de recherche en haut des
  onglets Thèmes / Partis / Suivis / Infos ouvre un écran de recherche dédié (champ
  auto-focus + résultats). L'Accueil garde sa recherche intégrée.
- Écriture inclusive : correction des titres d'en-tête oubliés (Député, Élus du groupe,
  Mon député).

## 1.0.38 — 2026-06-22
- Barre d'onglets : **retour au positionnement d'origine** (avant v1.0.25), `paddingBottom`
  fixe, sans `viewport-fit=cover` ni safe-area (qui la déréglaient en app installée).
  Le correctif anti-zoom (champs à 16 px) est conservé.

## 1.0.37 — 2026-06-22
- Barre d'onglets encore descendue (marge ≈ 10 px), quasi collée au bas de l'écran.

## 1.0.36 — 2026-06-22
- Barre d'onglets descendue, calée plus bas (marge safe-area resserrée), tout en
  gardant un petit dégagement au-dessus du home indicator.

## 1.0.35 — 2026-06-22
- Correctif iOS : les **champs de recherche passent à 16 px** pour empêcher le **zoom
  automatique** d'iOS au focus (sous 16 px, iOS zoome). Ce zoom décalait aussi le menu
  du bas (safe-area gonflée). Règle l'un et l'autre.

## 1.0.34 — 2026-06-22
- Lisibilité : **titres de scrutins agrandis** (cartes et listes) et libellés de la grille
  de thèmes un peu plus grands ; meilleure hiérarchie (placeholder ≠ titre).
- Listes denses : **filtre par année puis par mois** (thèmes, grands scrutins, votes d'un
  élu, votes d'un groupe) — barre de chips au-dessus de la liste.

## 1.0.33 — 2026-06-22
- Correctif important : **« Trouver mon député » remarchait** (recherche par commune /
  code postal). La politique de sécurité (CSP) bloquait l'API Géo officielle
  `geo.api.gouv.fr` (absente de `connect-src`) → aucune commune trouvée. Autorisée.

## 1.0.32 — 2026-06-22
- **Écriture inclusive retirée** partout (député, élus, citoyen… plus de points médians).
- Recherche : placeholder « Rechercher député, parti, scrutin » + taille de texte réduite
  (ne fait plus la taille d'un titre).
- **Slider des grands scrutins : flèches de navigation** sur desktop (le swipe souris
  n'existe pas) — précédent/suivant.

## 1.0.31 — 2026-06-22
- Barre d'onglets : descendue d'environ 8 px (marge basse `env(safe-area-inset-bottom) - 8px`)
  pour réduire l'espace sous les libellés, tout en restant au-dessus du home indicator.

## 1.0.30 — 2026-06-22
- Correctif (app installée iOS) : les **libellés de la barre d'onglets** (Accueil/Thèmes/…)
  n'étaient plus visibles, rognés par le home indicator. Réservation de la safe-area avec
  le bon dosage : `max(10px, env(safe-area-inset-bottom))` (et non additif → plus de barre
  trop haute). Hauteur identique sur tous les onglets.

## 1.0.29 — 2026-06-22
- Fiche élu : la **barre de ventilation des votes** (Pour/Contre/Abst.) s'affiche aussi
  sur la carte de thème **repliée**, comme sur la fiche parti.
- Masquage de la barre d'onglets au clavier : détection plus fiable (focus du champ),
  pour fonctionner aussi en **app installée iOS** (où VisualViewport n'était pas fiable).

## 1.0.28 — 2026-06-22
- Correctif : la **barre d'onglets se masque quand le clavier est ouvert** (recherche).
  Avant, le clavier la recouvrait à moitié → petite et difficile à taper. Elle réapparaît
  dès que le clavier se ferme. Détection via l'API VisualViewport.

## 1.0.27 — 2026-06-22
- Barre d'onglets : retour **exact au comportement d'origine** (retrait du `100dvh` qui,
  en app installée, étendait la racine sous le home indicator et **coupait les libellés**).
  Hauteur fixe, libellés visibles, identique sur tous les onglets.

## 1.0.26 — 2026-06-22
- Barre d'onglets : **hauteur fixe restaurée** (identique sur tous les onglets). Retrait
  de `viewport-fit=cover` et de la marge safe-area qui la rendaient trop haute sur iPhone.

## 1.0.25 — 2026-06-22
- Fiche élu : les **thèmes sont désormais repliés par défaut** (comme la fiche parti) ;
  au dépli, les gros boutons Pour / Contre / Abst. / Absent + « tous les votes du thème ».
- Correctif iOS : la **barre d'onglets** ne passe plus sous la barre d'outils de Safari
  (racine en `100dvh`) — plus facile à taper.

## 1.0.24 — 2026-06-22
- Fiche parti : au dépli d'un thème, on voit désormais les **mêmes gros boutons
  Pour / Contre / Abst.** que sur la fiche d'un·e élu·e (composant `PositionCells`
  partagé), au lieu de simples lignes. Cohérence visuelle élu ↔ parti.

## 1.0.23 — 2026-06-22
- Correctif d'exploitation (incident du jour) : un asset manquant pendant la propagation
  d'un déploiement ne renvoie plus un fallback HTML 200 (qui pouvait être mis en cache
  « immutable » sous l'URL du bundle et casser le site) mais un **vrai 404** (`/_expo/*`
  et `/data/*` → page 404). L'app garde toujours l'URL « / », donc aucun impact usage.

## 1.0.22 — 2026-06-22
- Fiche parti : au dépli d'un thème, **Pour / Contre / Abstention sont cliquables** et
  mènent à la liste des scrutins où le groupe a tenu cette position sur ce thème (même
  pattern que la fiche député). Données : positions du groupe par scrutin (`groupe/<uid>.json`).

## 1.0.21 — 2026-06-22
- Fiche parti revue. **Cohésion** et **Participation** sont expliquées en clair, avec
  un repère « moyenne des groupes » (↑/↓) et une ⓘ pour la définition. L'**activité
  parlementaire** affiche toujours l'écart à la moyenne (amendements ET propositions),
  même en-dessous. Les **thèmes sont dépliables** (Pour/Contre/Abstention au détail).
  Nouveau : accès à la **liste complète des élu·e·s du groupe**.

## 1.0.20 — 2026-06-22
- Thèmes repensés. **Accueil** : la grille « Explorer par thème » affiche le **nombre
  de scrutins** par sujet (une raison de cliquer, tout reste visible d'un coup d'œil).
  **Onglet Thèmes** : passage en **lignes informatives** (nombre de scrutins, date du
  dernier, intitulé du dernier vote) — bien plus lisible et utile au pouce qu'une grille
  de tuiles muettes. Données enrichies dans `categories.json` (pipeline).

## 1.0.19 — 2026-06-22
- Bandeau d'installation iPhone : la notice précise désormais qu'il faut **faire
  défiler** la feuille de partage (au besoin « Voir plus ») pour atteindre
  « + Sur l'écran d'accueil », souvent sous la ligne de flottaison.

## 1.0.18 — 2026-06-22
- Bandeau d'installation sur iPhone : notice clarifiée (« Ouvrez Partager via le
  menu ⋯ du navigateur, puis + Sur l'écran d'accueil ») et retrait de l'icône
  Partage qui laissait croire, à tort, que le bandeau était cliquable.

## 1.0.17 — 2026-06-22
- Accueil : **bandeau « Installer Scrutoir »** en bas de l'écran. Sur Android/Chrome,
  un bouton déclenche la **vraie pop-up d'installation** ; sur iPhone (Safari), une
  notice explique « Partager → Sur l'écran d'accueil » (Apple n'autorise pas
  l'installation automatique). Masqué si l'app est déjà installée, et rejetable.

## 1.0.16 — 2026-06-22
- Interne : la mesure d'audience distingue désormais le **type d'appareil**
  (mobile / tablette / desktop), dérivé de la largeur de viewport (anonyme,
  agrégé). Nouveau bloc « Répartition par appareil » dans le tableau de bord.

## 1.0.15 — 2026-06-22
- Écran de lancement animé : l'**hémicycle se remplit siège par siège** (le logo
  comme barre de chargement) sous le mot « Scrutoir », puis se fond dès que l'app
  est prête. Affiché avant même le chargement du bundle, plancher de visibilité
  1,6 s (le temps que l'hémicycle finisse de se remplir), respecte « réduire les
  animations » (accessibilité).

## 1.0.14 — 2026-06-21
- Page **Mentions légales & confidentialité** (éditeur Seedger, hébergeur, source des
  données, vie privée), accessible depuis l'écran Infos. Contact : contact@scrutoir.fr.

## 1.0.13 — 2026-06-21
- Partage : **aperçus de lien soignés** (Open Graph / Twitter) quand on partage
  scrutoir.fr sur les réseaux, la presse ou une messagerie — image + titre + description.
- Sécurité : en-tête **HSTS** (HTTPS strict).

## 1.0.12 — 2026-06-21
- Fiabilité : **garde-fou** sur le rafraîchissement quotidien — refuse de publier des
  données vides/cassées (l'app en ligne reste intacte) + alerte automatique en cas d'échec.
- Sécurité : **en-têtes durcis** (CSP, anti-clickjacking, Referrer-Policy…) + Dependabot.
- Vie privée : **photos des député·e·s auto-hébergées** — plus aucun appel aux serveurs
  de l'Assemblée côté utilisateur (fiabilité + hors-ligne).

## 1.0.11 — 2026-06-21
- Écran Infos : notice **« Mesure d'audience »** (transparence sur la mesure anonyme) +
  section **« Concrètement »** (sans cookie/IP, compteurs agrégés, liste de suivis locale).

## 1.0.10 — 2026-06-21
- Interne : les suivis de partis sont mesurés séparément des suivis de députés →
  classements analytics dédiés (« Partis les plus suivis / consultés ») avec les sigles.

## 1.0.9 — 2026-06-21
- On peut désormais **suivre un parti** (cloche sur la fiche d'un groupe), comme un·e
  député·e. Les partis suivis apparaissent dans « Mes suivis » (accueil) et dans l'onglet
  Suivis (raccourci « Partis suivis »).

## 1.0.8 — 2026-06-21
- Accueil : section **« Mes élu·e·s suivi·e·s »** — accès rapide aux député·e·s que vous
  suivez (privé, sur votre appareil), avec raccourci vers leurs votes. (Remplace la section
  Tendances publique, retirée : les statistiques d'usage restent privées.)

## 1.0.6 — 2026-06-21
- Interne : mesure aussi les recherches, les clics « source officielle » et les
  installations de l'app. Tableau de bord analytics redesigné (KPI, classements,
  courbe d'activité) et auto-évolutif.

## 1.0.5 — 2026-06-21
- Interne : mesure d'audience **privacy-first** (sans cookie, sans IP, anonyme) via un
  Worker Cloudflare + Analytics Engine. Trace de façon agrégée : écrans/contenus
  consultés, duels regardés, suivis, recherches. Tableau de bord privé séparé.

## 1.0.4 — 2026-06-20
- Écran Infos : ajout de la note « Pourquoi Scrutoir ? » (origine du nom).

## 1.0.3 — 2026-06-20
- Nouvel onglet **Suivis** : retrouvez les **derniers votes** des élu·e·s que vous suivez
  (bouton cloche sur une fiche élu), avec un badge **« Nouveau »** sur les votes depuis
  votre dernière visite. 100 % côté app, sans serveur (les vraies notifications push,
  qui font vibrer le téléphone, restent une évolution future nécessitant un serveur).

## 1.0.2 — 2026-06-20
- Accueil : les cartes de grands scrutins affichent l'**intitulé officiel** de la loi
  (titre du dossier législatif) au lieu du libellé brut « l'ensemble de la proposition… ».
- Interne : API Express marquée dev-only, fichiers de déploiement obsolètes supprimés.

## 1.0.1 — 2026-06-20
- Photos d'illustration des thèmes **hébergées en local** (plus d'appel externe à
  Unsplash) : fiabilité, vie privée (aucune IP utilisateur envoyée à un tiers),
  fonctionnement hors-ligne. (Régénérables via `app/scripts/gen-hero.sh`.)
- Mise à jour quotidienne **automatique** des données activée (GitHub Actions → cron).

## 1.0.0 — 2026-06-20 — Première version publique
- PWA installable (écran d'accueil iOS/Android), fonctionnement hors-ligne.
- Recherche députés / partis / scrutins ; fiche élu (participation, votes par thème,
  dissidences) ; détail scrutin (résultat, position par groupe, votants).
- Confrontation de deux élus ; « Trouver mon·ma député·e » (département → circonscription).
- Fiches partis (cohésion, participation, activité).
- **Résumés officiels** des votes sur loi entière (intitulé officiel du dossier législatif,
  Open Data AN — sans IA) ; exposé des amendements pour les votes d'amendement.
- Mise en ligne sur Cloudflare Pages (`scrutoir.pages.dev`), refresh quotidien des données.
- **Mises à jour automatiques** : plus besoin de réinstaller l'app — elle se met à jour
  seule à la réouverture.
- Correctif : icônes (polices) absentes en ligne (dossiers `node_modules` ignorés par
  Cloudflare Pages).
