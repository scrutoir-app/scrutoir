# Scrutoir — contexte projet (pour Claude)

App qui montre **ce que votent réellement les députés français** (vue **électeur**), à partir
de l'Open Data de l'Assemblée Nationale (17ᵉ législature). Nom : **Scrutoir** (racine `scrut-` de
scrutin + sonorité d'un lieu d'observation ; picto = hémicycle de sièges + point focal central =
tribune/pupille, `components/ScrutoirMark.tsx`). ⚠️ Dispo nom à sécuriser : INPI cl. 9 & 42 + domaines.
Objectif : confronter discours et actes, de façon **neutre** (aucune couleur de parti ne domine).

## Stack & structure
- `pipeline/` — ingestion Open Data AN → base **SQLite** (Node + TypeScript, `tsx`).
- `api/` — API HTTP Express au-dessus de la base (port **4000**).
- `app/` — app **Expo / React Native** (web + iOS + Android).
- `data/` — `votes.db` + archives brutes (git-ignoré).
- Base en SQLite (prototype) ; schéma **portable vers Postgres/Supabase** pour la mise en ligne.

## ⚠️ Lancer le projet (Node via nvm — PAS de Docker/Homebrew sur la machine)
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"   # node v24.17 (chemin: ~/.nvm/versions/node/v24.17.0/bin)
cd pipeline && npm install && npm run ingest        # télécharge données AN + amendements (~270 Mo) + calcule, ~30s
cd ../api && npm start                              # API -> http://localhost:4000
cd ../app && npm run web                            # app -> http://localhost:8081 (navigateur du Mac)
```
- **Accès téléphone — SOLUTION QUI MARCHE** : tunnel **Cloudflare quick tunnel** (sans compte) vers le
  **service mono-origine** (l'API sert aussi le web exporté `app/dist` sur :4000). LAN bloqué (pare-feu
  macOS) et ngrok bloqué par McAfee, mais cloudflared passe (sortant). Recette :
  ```bash
  cd app && EXPO_PUBLIC_API_BASE="" npx expo export -p web   # (re)build web si l'app a changé
  cd ../api && PORT=4000 npm start                           # sert web + API en même origine
  # binaire cloudflared (1 fichier, pas d'install) :
  curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz -o /tmp/cf.tgz && tar -xzf /tmp/cf.tgz -C /tmp && chmod +x /tmp/cloudflared
  /tmp/cloudflared tunnel --url http://localhost:4000        # → URL publique *.trycloudflare.com
  ```
  ⚠️ Lien **temporaire** (change à chaque lancement, vit tant que le Mac + les 2 process tournent).

## 🚧 MIGRATION EN COURS — ARCHITECTURE CIBLE : TOUT STATIQUE (Cloudflare Pages)
**Décisions actées (non négociables), coût d'usage ≈ 0 € :**
- **Abandon du serveur Express en prod** (l'API Express devient dev-only). La donnée (lecture seule,
  par lots) est **pré-générée en JSON** et servie en **statique sur Cloudflare Pages** (gratuit, egress
  gratuit, requêtes d'assets non plafonnées). Pas de Worker/D1/R2 (inutile : tout se résout en statique).
- **Dépôt public**, **refresh quotidien** par GitHub Action, démarrage sur **`scrutoir.pages.dev`**
  (domaine `scrutoir.fr` plus tard). **v1 = PWA installable** ; apps natives iOS/Android **repoussées**
  (donc pas de prérequis stores pour l'instant). Push repoussé.
- ⚠️ NE PAS reconduire le piège « base 174 Mo téléchargée au boot » (archi Render/`DEPLOY.md` obsolète).

**FAIT (étapes 1-2, commit `Archi statique (étapes 1-2)`), vérifié en local :**
- `pipeline/src/exportStatic.ts` (+ `npm run export:static`) → ~8000 fichiers JSON dans `app/public/data/`
  (git-ignoré) : `deputes.json`, `scrutins.json` (index léger + `cats[]` = toutes les catégories),
  `categories/partis/grands.json`, `parti/<uid>.json`, `depute/<uid>.json` (profils 3 périodes +
  dissidences + carte de votes `{scrutin:[position,consigne]}`), `scrutin/<uid>.json` (détail + votants).
  Réutilise `stats.ts` → données identiques à l'API.
- `app/src/api.ts` réécrit en **couche données statique** (mêmes signatures → écrans inchangés) : lit
  `/data/...` (base `EXPO_PUBLIC_DATA_BASE`, défaut "" = même origine ; Expo web sert `public/` en dev et
  copie dans `dist/` à l'export). Recherche / drill-downs / confrontation **calculés côté client** depuis
  les index. Multi-catégorie géré via `cats[]` (cartes profil == drill-down == confrontation, vérifié).

**FAIT (étape 3 — PWA installable), vérifié en local (build `dist` servi sur :8099) :**
- **Choix d'archi** : Expo SDK 56 = Metro web **sans Expo Router** → pas de `+html.tsx`, l'`index.html`
  est généré sans hook. Donc PWA câblée par des fichiers statiques dans `app/public/` (copiés tels quels
  dans `dist/` à l'export) + un **patch post-export** de l'`index.html`. **SW vanilla, PAS Workbox**
  (pas de build step ni dépendance CDN ; offline immédiat ; stratégies alignées sur le cache-busting).
- `app/public/manifest.json` : `display: standalone`, `theme_color #3C4654`, `background_color #F2F4F7`,
  icônes 192/512 `any` + 192/512 `maskable`, `start_url /?source=pwa`, `lang fr`.
- `app/public/icons/*` : générées par **`sips` (natif macOS)** depuis `assets/icon.png` 1024 →
  `app/scripts/gen-icons.sh` (maskable = réduit à 80% + pad fond `#F2F4F7` pour la safe zone). Committées
  (assets de marque, pas régénérées en CI).
- `app/public/sw.js` : SW vanilla. Stratégies : navigation **network-first** (repli `index.html` offline) ;
  bundle `/_expo/static/**` **cache-first** (hashé) ; `/data/scrutin/**` **cache-first** (immuable) ;
  autres `/data/**` (index, depute, parti, categories) **stale-while-revalidate** ; `/data/version.json`
  **network-first** (détection de déploiement). `CACHE_VERSION` à bumper pour invalider. Écoute
  `postMessage('SKIP_WAITING')` (prêt pour un futur bandeau « mise à jour dispo »).
- `app/scripts/patch-pwa.mjs` : post-export, **idempotent** (marqueur `SCRUTOIR_PWA`). Met `lang="fr"`,
  injecte manifest + `theme-color` + meta apple + description, l'enregistrement du SW (`/sw.js`, scope `/`),
  et le **splash de lancement** (hémicycle qui se remplit siège par siège, juste après `<body>`) masqué par
  `window.__scrutoirReady()` appelé depuis `App.tsx` (polices prêtes ; plancher 1,6 s ; `prefers-reduced-motion`).
- Script npm **`build:web`** = `expo export -p web && node scripts/patch-pwa.mjs` (à utiliser en CI étape 4).
- Vérifié : manifest 200 (application/json), sw.js 200 (text/javascript), SW actif & `controller` =
  scope racine, caches `scrutoir-shell-v1` (index, `/`, bundle JS, fonts, icônes, manifest) + `scrutoir-data-v1`
  (JSON chargés) peuplés, app rend sans erreur console. Config preview `scrutoir-dist` ajoutée dans
  `Brain/.claude/launch.json` (python3 `http.server` sur `dist/`, port 8099).
- ⚠️ Le test offline « serveur coupé + reload » n'est pas faisable via l'outil preview (couper le serveur
  ferme la session navigateur) ; prouvé par le contenu des caches + revue des handlers. À retester
  manuellement (DevTools → Network → Offline) avant mise en ligne.

**FAIT (étape 4 — refresh quotidien), code prêt (déploiement réel = étape 5, à valider) :**
- `pipeline/src/exportStatic.ts` génère désormais **`data/version.json`** (`generatedAt`, compteurs) →
  cache-busting / détection de déploiement. Vérifié (`npm run export:static` OK : 577 députés, 7422 scrutins).
- **Téléchargement conditionnel ETag** : `download.ts` gagne un mode `refresh` (`telechargerConditionnel`,
  sidecar `data/raw/*.etag`, `If-None-Match`, 304 → garde le local). Nouveau flag `--refresh` +
  script **`npm run ingest:refresh`** (CI). Les modes `force`/défaut sont inchangés (dev local). Signatures
  `assurer*` passées de `(force)` à `({force, refresh})` ; call sites à jour (ingest.ts, linkAmendements.ts).
  ⚠️ Typecheck : 3 erreurs **préexistantes** restantes sur `propagees` (classify.ts/ingest.ts), sans rapport
  (tsx ne typecheck pas → runtime OK) — à corriger à part.
- **`.github/workflows/refresh.yml`** : cron 05:10 UTC + `workflow_dispatch`. Steps : checkout → node 24 →
  cache `data/raw` (clé `raw-<run_id>` + restore-keys `raw-` → profite du 304 sur Amendements 270 Mo) →
  `npm ci` (pipeline) → `ingest:refresh` → `export:static` → `npm ci` (app) → `build:web` →
  `cloudflare/wrangler-action@v3 pages deploy app/dist --project-name=scrutoir`. Secrets attendus :
  `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- **Cloudflare Pages** : `app/public/_headers` (cache CDN : immuable `/_expo/static/*` + `/data/scrutin/*` ;
  revalidation coquille/SW/données mutables ; `version.json` no-cache) + `app/public/_redirects`
  (`/* /index.html 200`, fallback SPA défensif ; le routing est **en mémoire** dans App.tsx → l'URL reste à
  `/`, donc surtout préventif). Tous deux copiés dans `dist/` à l'export (vérifié).
- Build complet vérifié : `npm run build:web` → `dist/` contient `_headers`, `_redirects`, `manifest.json`,
  `sw.js`, `icons/`, `data/version.json`. Ordre `export:static` → `build:web` respecté dans le workflow.

**🟢 EN LIGNE — https://scrutoir.fr (+ https://scrutoir.pages.dev)**
- Domaine **scrutoir.fr** (acheté chez Gandi) branché via Cloudflare : NS délégués à Cloudflare
  (`fonzie`/`liberty.ns.cloudflare.com`), zone active, custom domain ajouté au projet Pages `scrutoir`.
  Gandi reste le registrar/facturation. HTTPS auto OK. **`www.scrutoir.fr`** aussi branché (custom domain
  Pages, sert l'app — pas de redirection canonique, raffinable plus tard via Redirect Rules).
- Versionnage : `APP_VERSION` dans `app/src/config.ts` (affiché écran Infos), `CHANGELOG.md`. Version **1.0.42**.
- **Analytics privacy-first** (sans cookie/IP/identifiant, RGPD, pas de bandeau) : Worker `analytics/`
  (`scrutoir-analytics`, déployé sur `scrutoir-analytics.anthony-627.workers.dev`) → `POST /collect` écrit
  dans **Analytics Engine** (dataset `scrutoir_events`) — n'enregistre QUE depuis nos origines (anti-spam) ;
  `GET /stats` = tableau de bord privé en **HTTP Basic Auth** (mot de passe = `DASH_KEY`, plus de clé dans l'URL).
  Classements : duels, **partis** suivis/consultés (event `follow_parti`/`parti`), députés suivis/consultés,
  scrutins, écrans, thèmes, recherches. App : `src/analytics.ts track()` (sendBeacon, URL figée), hooks dans
  App.tsx (écran/entité/install), ConfrontationScreen (duels), follows.ts (follow/unfollow + follow_parti),
  SearchScreen (recherches), ScrutinScreen (clic source). Secrets Worker (NON committés) : `DASH_KEY` +
  `CF_API_TOKEN` (Account Analytics:Read). Déploiement : `cd analytics && wrangler deploy`. (Endpoint public
  `/trends` créé puis RETIRÉ — pas de tendances publiques.) Détail/lien/mdp : voir mémoire brain `scrutoir-analytics-dashboard`.
- **Onglet Suivis** (5e onglet, cloche) : `SuivisScreen.tsx` + `getVotesSuivis()` (api.ts) → feed des votes
  des élu·e·s suivi·e·s (follows.ts), badge « Nouveau » via `getLastSeen`/`markSeen` (localStorage). 100 %
  client-side. ⚠️ Le **push réel** (notif hors-app) reste à faire (nécessite un serveur ; `notifierNouveauxVotes`
  est toujours un stub). PWA iOS 16.4+ supporte le web push mais il faut un serveur d'envoi.
- Mises à jour auto (plus de réinstall) : SW vérifie au lancement + à chaque réouverture, recharge à la prise
  de contrôle (script dans `patch-pwa.mjs`). Caches SW séparés SHELL (bump/release) / DATA (stable).
- **Refresh quotidien ACTIF** (GitHub Actions) : dépôt **public** `github.com/scrutoir-app/scrutoir`,
  workflow `refresh.yml` (cron 05:10 UTC + `workflow_dispatch`), secrets `CLOUDFLARE_API_TOKEN` (jeton custom
  Pages:Edit) + `CLOUDFLARE_ACCOUNT_ID` posés. 1ʳᵉ exécution manuelle vérifiée OK (4 min, déploie sur Pages).
  Compte GitHub **scrutoir-app**. `gh` installé en `~/.local/bin/gh` (binaire, hors PATH système) ; helper git
  configuré (`git config credential.https://github.com.helper "!~/.local/bin/gh auth git-credential"`).
  ⚠️ Workflow : pousser le code sur GitHub (`git push origin main`) pour que le robot prenne les nouveautés.
  Déclencher à la main : `gh run watch` / `gh workflow run refresh.yml --repo scrutoir-app/scrutoir`.
- **Photos thèmes self-hébergées** (`app/public/hero/<id>.jpg`, 35 images Unsplash licence libre, ~4 Mo,
  committées) → plus d'appel externe (vie privée + hors-ligne). `categoryUI.ts ph()` → `/hero/<id>.jpg`.
  Régénérables : `app/scripts/gen-hero.sh`.
- Déploiement manuel (hors robot) : `cd app && export CLOUDFLARE_ACCOUNT_ID=627984d2dd614e139df12342e9f2469a &&
  npx wrangler pages deploy dist --project-name=scrutoir --branch=main --commit-dirty=true`.

- Projet Cloudflare Pages `scrutoir` créé (Direct Upload), compte **anthony@seedger.com**, account id
  `627984d2dd614e139df12342e9f2469a`. Déploiement local : `cd app && export CLOUDFLARE_ACCOUNT_ID=… &&
  npx wrangler pages deploy dist --project-name=scrutoir --branch=main --commit-dirty=true`
  (wrangler déjà connecté via `wrangler login`). Vérifié en prod (page, manifest, sw, data 200).
- ⚠️ **PIÈGE Cloudflare Pages corrigé** : Pages **ignore les dossiers `node_modules`** à l'upload → les
  polices d'icônes Expo (`dist/assets/node_modules/…`) n'étaient pas déployées → **icônes en carrés vides**.
  Fix permanent dans `patch-pwa.mjs` (`fixVendorFonts`) : renomme `assets/node_modules` → `assets/vendor`
  et réécrit les refs dans le bundle. **Ne jamais remettre de `node_modules` dans le contenu déployé.**
- **Résumés officiels des lois** (demandé : officiel, pas d'IA) : `scrutins.dossier_titre` rempli par
  `lierDossiers()` (`activiteGroupes.ts`) via le lien fiable `voteRefs.voteRef` des Dossiers AN →
  `titreDossier.titre`. 229 scrutins reliés (63/75 grands). `ScrutinScreen` affiche un bloc « Objet du
  texte » pour les votes sans amendement (lois entières, motions). L'exposé des motifs **complet** (paragraphe)
  n'est pas dans les Dossiers (dataset *Documents/textes*, plus lourd) → enhancement futur possible.
- **`dossier_titre` aussi sur l'accueil** : `grandsScrutins()` l'expose → `grands.json` ; `HeroScrutins` affiche
  l'intitulé officiel au lieu du libellé brut (`ScrutinResume.dossier_titre`).
- **Onglet Suivis = partis aussi** : on peut **suivre un parti** (cloche `PartiScreen`, `useFollow`). Stockés dans
  la même liste de suivis, distingués par préfixe d'uid (`PA…` député / `PO…` parti). Onglet Suivis : rangée
  « Partis suivis » + feed des votes des députés. Accueil : section **« Mes suivis »** (`components/MesSuivis.tsx`,
  partis + députés). `api.getDeputesByUids()`.
- **Photos des députés auto-hébergées** : `pipeline/src/photos.ts` (`localiserPhotos`, hook dans ingest) télécharge
  dans `app/public/photos/<id>.jpg` (577 committées) et réécrit `deputes.photo_url` → `/photos/…`. Plus aucun
  appel aux serveurs AN côté utilisateur (vie privée + hors-ligne).
- **Fiabilité** : garde-fou dans `exportStatic.ts` (refuse d'exporter si < 400 députés / 1000 scrutins / 5 groupes)
  + étape « Alerte si échec » (issue GitHub) dans `refresh.yml` (permission `issues: write`).
- **Sécurité** : `_headers` durci (CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy ; CSP testée
  OK avec Expo/RN web) + `.github/dependabot.yml` (app, pipeline, github-actions).
- **Partage** : Open Graph / Twitter Card (balises dans `patch-pwa.mjs`, image `app/public/og.png` 1200×630).
- **Écran Infos** : note « Pourquoi Scrutoir ? » + notices « Mesure d'audience » / « Concrètement » (transparence
  RGPD) + lien vers **page Mentions légales & confidentialité** (`MentionsScreen.tsx`, route `mentions`) — éditeur
  **Seedger**, hébergeur Cloudflare, contact **contact@scrutoir.fr**.
- **Email contact@scrutoir.fr** : réception OK (Cloudflare Email Routing → anthony@seedger.com). Répondre « depuis »
  l'adresse = EN COURS (Brevo SMTP + Gmail), bloqué sur un réglage admin Google Workspace → voir mémoire brain
  `scrutoir-email-contact`.
- **Logos** : `votes-deputes/brand/` (SVG fond clair + blanc + PNG) pour Canva/partage.

**RESTE À FAIRE (idées « pour plus tard ») — plusieurs investiguées et reportées sciemment :**
- **EN COURS — finir l'envoi email** « répondre depuis contact@scrutoir.fr » : tout est prêt (Brevo + DNS), il
  manque que l'**admin Google Workspace seedger.com** active « passerelles sortantes par utilisateur », puis
  ajouter l'adresse dans Gmail (SMTP Brevo). Étapes exactes : mémoire brain `scrutoir-email-contact`. + DKIM email (optionnel).
- **Exposé des motifs complet** des lois (paragraphe) : REPORTÉ — dataset *Documents/textes* AN ≈ plusieurs
  Go (alourdit le robot) pour valeur marginale vs l'intitulé officiel déjà affiché. Chemin du dataset non
  trouvé (probes 404). Rouvrir seulement si vraiment voulu.
- **Photo de l'auteur/rapporteur** sur le hero : REPORTÉ — couverture faible (17/75 grands ont un député
  avec photo via `initiateur.acteurs.acteur.acteurRef`) + risque de **biais** (un visage sur une loi
  collective) contraire à la neutralité. Le picto catégorie reste préférable.
- **Recherche par code postal** → circonscription : REPORTÉ — pas de table fiable (villes = plusieurs circos
  par code postal) ; le parcours département→circo existant suffit.
- `www` : raffinable en **redirection** canonique www→apex (Cloudflare Redirect Rules) au lieu des 2 qui
  servent l'app. Optionnel.
- Repoussé (décisions projet) : apps natives iOS/Android (stores) + push ; classification IA des ~10 % non
  classés (clé Anthropic, `npm run classify:ia`).
- Hors-code : dépôt marque **INPI** (cl. 9 & 42).
- Dév local classique : `api` (:4000, dev-only) + `app` `npm run web` (:8081, navigateur du Mac).

## Source de données (data.assemblee-nationale.fr, licence Etalab)
- Scrutins : `repository/17/loi/scrutins/Scrutins.json.zip` (position nominative par député).
- Acteurs/Organes : `repository/17/amo/.../AMO10_...json.zip` (députés, groupes).
- Amendements : `repository/17/loi/amendements_div_legis/Amendements.json.zip` (~270 Mo, lu en
  streaming via `node-stream-zip`).
- Photos : `www2.assemblee-nationale.fr/static/tribun/17/photos/{idNumérique}.jpg`.

## Ce qui est construit (vue électeur ~terminée)
- **Recherche** : députés + **partis** (alias usuels dans `pipeline/src/stats.ts` : LR→DR, PS→SOC,
  EELV→ECOS, Renaissance→EPR, MoDem→DEM, Ciotti→UDDPLR…) + scrutins.
- **Fiche élu** : **Participation** relative (« plus assidu·e que X% »), période (Depuis 2024 / 12m / 6m),
  **cartes thème « tout cliquable »** (titre + 4 cases Pour/Contre/Abst/**Absent** + ligne **Non votant**),
  drill-downs. ⚠️ **Plus de score de loyauté agrégé ni de réussite** (recos 6/7) : à la place, la
  **consigne du groupe est affichée par scrutin** dans le drill-down des votes (« consigne : X · écart »)
  + les dissidences. **Seuil de fiabilité** (reco 3, `app/src/config.ts SEUIL_FIABILITE`) : sous le seuil
  de votes exprimés, la case est grisée (« trop peu pour dégager une position »). **Circonscription** +
  bouton **Suivre** (cloche, `app/src/follows.ts`). Lien **source AN** sur le détail scrutin.
- **Détail scrutin** : bandeau Adopté/Rejeté, **exposé d'amendement** (résumé visible par défaut, reco 9),
  position par groupe (cases cliquables → votants), **lien `assemblee-nationale.fr/dyn/17/scrutins/{n°}`**.
- **Confrontation de deux élus** (reco 1, `ConfrontationScreen` + `/confrontation`) : 2 sélecteurs
  symétriques + période, thèmes triés du plus divergent au plus convergent (seuil reco 3), thèmes
  « non couvert » listés à part (silence ≠ désaccord), synthèse honnête. CTA accueil.
  **(v1.0.42)** par thème, **barre divergente accords (vert, gauche) / désaccords (rouge, droite)**
  (`components/BarreDivergente.tsx`, partagée avec la fiche parti) ; au dépli, **boutons Accord /
  Désaccord** (`PositionCells`) → **page dédiée** `ConfrontationListeScreen` (route `confrontationListe`)
  listant les scrutins (résumé + lien source AN) avec **filtres année/mois** (`useScrutinDateFilter`).
- **Mon·ma député·e** (reco 10, `MonDeputeScreen` + `/departements`, `/circonscription`) : département →
  circonscription → élu. CTA accueil. (Code postal → circo = référentiel à ajouter ; push = backend.)
- **Menu Partis** : liste des groupes (nb élus) + fiche parti = **président·e**, **cohésion**,
  **participation moyenne**, **activité parlementaire** (amendements + propositions, signal d'obstruction),
  et **positions par thème** — **(v1.0.42) barre divergente** Pour (centre→gauche) / Contre (centre→droite),
  part relative aux exprimés, axe central aligné (`components/BarreDivergente.tsx`) ; dépli → boutons
  Pour/Contre/Abst (`PositionCells`) → scrutins du groupe. API `/partis`, `/partis/:uid`.
- Dissidences, votants, listes par thème/position, écran Thèmes, À propos, **barre d'onglets** (4 :
  Accueil · Thèmes · Partis · Infos).
- Accueil : **carrousel hero swipeable** des derniers grands scrutins (`components/HeroScrutins.tsx`,
  FlatList horizontal + snap + points de pagination) au lieu de la liste verticale → gagne de la
  hauteur, ajoute un visuel. Carte hero = **photo de fond par thème** (`ImageBackground`, hauteur 210)
  + **voile sombre** (lisibilité) + **texte blanc** (titre non gras, Manrope SemiBold). Photos =
  `categoryUI.ts` champ `photos[]` (**2-3 par catégorie**) → **PLACEHOLDERS Unsplash** (à remplacer
  par des visuels sous licence avant mise en ligne). Rotation **déterministe par scrutin** via
  `catPhoto(catId, scrutin.uid)` (hash → index) : stable pour un scrutin donné, variée d'une carte à
  l'autre. Slot **photo du porteur** prévu en avatar
  (`ScrutinResume.porteur_nom/porteur_photo` — affiche le chip icône de catégorie tant que non
  branché), kicker (Projet/Proposition de loi / Motion de censure dérivé du libellé), badge
  Adopté/Rejeté, barre de votes. « Tout voir » → `GrandsScrutinsScreen` (route `grandsScrutins`).
  ⚠️ Largeur alignée sur les autres composants via **mesure `onLayout`** (pas `useWindowDimensions`,
  qui ≠ largeur du contenu centré) + remontage `key={winW}` pour reflow au resize web. Largeur de
  repli (`effW = boxW || min(winW,560)`) pour rendre tout de suite (sinon hero effondré si `onLayout`
  tarde au 1er rendu).
- Accueil, « Explorer par thème » : **grille fixe de pictos NEUTRES** (`components/CategoryGrid.tsx`,
  4 colonnes × 3 lignes, 12 thèmes visibles sans défiler). Reco 11 : photo réservée au **hero** ; les
  tuiles thème sont des pictos neutres (icône + libellé court `categoryUI.court`) pour éviter la
  connotation éditoriale. ⚠️ **Porteur du hero non encore branché** : grands scrutins = lois entières
  (0/75 ont un `auteur`) → photo du porteur = extraire auteur/rapporteur des Dossiers législatifs (TODO).
- **Picto de catégorie** sur chaque scrutin (ScrutinCard/ScrutinRow ; API renvoie `categorie`
  principale par sous-requête). **Code couleur** sur le nombre d'amendements d'un parti (orange si
  > moyenne, rouge si ×≥1.5 → signal d'anomalie/obstruction).

## Design system (refonte « app moderne » faite)
- `app/src/theme.ts` : palette **neutre** (encre `#171A1F` + gris froid `#F2F4F7`), accent ardoise
  `#3C4654`, **vote en tons sourds** (pour `#4F9D83`, contre `#CC715E`, abst `#D6A24B`, absent gris).
  Police **Manrope** (`@expo-google-fonts/manrope`, helper `F`). Tokens RADIUS, `shadowCard`.
- `app/src/categoryUI.ts` : icône (MaterialCommunityIcons) + teinte douce par thème.
- Icônes via `@expo/vector-icons`, anneaux via `react-native-svg`.

## Pièges de données (IMPORTANT)
- **Scrutins publics nominatifs uniquement** (la plupart des votes sont à main levée, absents).
- **Les absents n'apparaissent pas** → l'absence est **DÉDUITE** : `scrutins du thème (fenêtre) −
  pour − contre − abstention − non-votants`. La participation est **basse pour tous** (~25% médian) →
  affichée en **relatif**. Calcul dans `pipeline/src/participation.ts` (col `deputes.participation_rate`).
- **Absence bornée au mandat** (reco 5) : le dénominateur est borné aux dates du mandat de siège
  (`deputes.mandat_debut`/`mandat_fin`, type ASSEMBLEE, extraites dans `parseActeurs.ts`) au lieu du
  total brut → évite les **absences fantômes** (arrivée par partielle, ex. Barnier 2025-09-28 : 94
  scrutins écologie au lieu de 350). ⚠️ Dataset AMO10 = **actifs uniquement** → `mandat_fin` toujours
  NULL (=aujourd'hui, correct pour les actifs) et **ex-députés absents** (fin de mandat réelle =
  dataset « tous mandats », à faire si on affiche les partants).
- **Non-votant ≠ absent** (reco 5) : la position `nonvotant` (présent, n'a pas pris part — ex. la
  **présidence de séance** : Braun-Pivet ~7300) est comptée et **étiquetée « Non votant »**, plus
  fondue dans l'« absent » déduit. `CategorieStats.nonvotant`, ligne dédiée sur la carte thème.
- `sort_code` : « **n'a pas adopté** » contient « adopté » → géré (négation) dans `parseScrutins.ts`.
- **Classification** thématique (12 catégories neutres, `pipeline/src/categories.ts`) : mots-clés en
  **mots entiers** + **propagation** aux amendements. Vocabulaire enrichi → **~10% non classés**
  (était 40% ; le reste = procédural/niche). Dataset **Dossiers législatifs** téléchargé
  (`data/raw/Dossiers.json.zip`) — a servi à diagnostiquer les thèmes manquants. **Reco 2 scaffoldée** :
  `pipeline/src/classifyIA.ts` (`npm run classify:ia`, modèle Haiku 4.5) reclasse les non-classés via
  l'API Anthropic, **gardé par `ANTHROPIC_API_KEY`** (no-op sans clé). Mots-clés conservés par défaut.
- **Exposé d'amendement** : jointure heuristique date+numéro+auteur (~91%), `pipeline/src/linkAmendements.ts`.

## Backlog (recommandations traitées : voir l'historique git "Reco N")
- **Reco 2 (IA)** : brancher une **clé Anthropic** → `npm run classify:ia` (scaffold prêt).
- **Mise en ligne** (cible mobile/stores) : SQLite→Supabase + build stores. Débloque le push réel
  (reco 10 : `follows.ts` + `notifierNouveauxVotes()` stub) et l'accès téléphone.
- **Référentiel code postal → circonscription** (reco 10) pour la recherche par code postal.
- **Dataset « tous mandats »** (reco 5) pour borner la fin de mandat des ex-députés (ministres/décès).
- **Photo du porteur** sur le hero (auteur/rapporteur via Dossiers législatifs).
- Remplacer les **photos Unsplash placeholder** du hero par des visuels sous licence.

## Reste à faire côté design (mineur)
- Le sélecteur segmenté `Tous · Pour · Contre…` sur le détail d'un thème (optionnel : les cases
  cliquables couvrent déjà le besoin). Sinon la refonte visuelle est faite.
