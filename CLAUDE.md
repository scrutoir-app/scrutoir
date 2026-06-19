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
  Pour du **permanent** sans Mac allumé → déploiement (cf. `DEPLOY.md`, `render.yaml` : service
  mono-origine, base ~174 Mo téléchargée au boot via `DB_URL`).
- Dév local classique : `api` (:4000) + `app` `npm run web` (:8081, navigateur du Mac).

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
  symétriques + période, désaccords puis accords par thème (seuil reco 3), thèmes « non couvert »
  listés à part (silence ≠ désaccord), résumé + lien source par scrutin, synthèse honnête. CTA accueil.
- **Mon·ma député·e** (reco 10, `MonDeputeScreen` + `/departements`, `/circonscription`) : département →
  circonscription → élu. CTA accueil. (Code postal → circo = référentiel à ajouter ; push = backend.)
- **Menu Partis** : liste des groupes (nb élus) + fiche parti = **président·e**, **cohésion**,
  **participation moyenne**, **activité parlementaire** (amendements + propositions, signal d'obstruction),
  et **positions par thème** (répartition pour/contre/abst — plus de réussite). API `/partis`, `/partis/:uid`.
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
