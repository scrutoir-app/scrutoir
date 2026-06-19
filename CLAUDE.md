# Hémicycle — contexte projet (pour Claude)

App qui montre **ce que votent réellement les députés français** (vue **électeur**), à partir
de l'Open Data de l'Assemblée Nationale (17ᵉ législature). Nom de travail : **Hémicycle**.
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
- **Accès téléphone (Expo Go) ne marche pas en local** : pare-feu macOS **activé** + **McAfee**
  (qui bloque `ngrok` comme faux positif). Tunnels essayés (cloudflared/ngrok) non fiables ici.
  → Pour l'instant on utilise l'app **sur le Mac** (`localhost:8081`). Vraie solution = mise en ligne.

## Source de données (data.assemblee-nationale.fr, licence Etalab)
- Scrutins : `repository/17/loi/scrutins/Scrutins.json.zip` (position nominative par député).
- Acteurs/Organes : `repository/17/amo/.../AMO10_...json.zip` (députés, groupes).
- Amendements : `repository/17/loi/amendements_div_legis/Amendements.json.zip` (~270 Mo, lu en
  streaming via `node-stream-zip`).
- Photos : `www2.assemblee-nationale.fr/static/tribun/17/photos/{idNumérique}.jpg`.

## Ce qui est construit (vue électeur ~terminée)
- **Recherche** : députés + **partis** (alias usuels dans `pipeline/src/stats.ts` : LR→DR, PS→SOC,
  EELV→ECOS, Renaissance→EPR, MoDem→DEM, Ciotti→UDDPLR…) + scrutins.
- **Fiche élu** : 2 stats (**Loyauté** en anneau + **Participation** relative « plus assidu·e que X% »),
  période (Depuis 2024 / 12m / 6m), **cartes thème « tout cliquable »** (titre + 4 cases
  Pour/Contre/Abst/**Absent**), drill-downs.
- **Détail scrutin** : bandeau Adopté/Rejeté, **exposé d'amendement pliable**, position par groupe
  (cases cliquables → votants).
- **Taux de réussite** (lentille publique, choix produit A — pas de login) : toggle
  « Positions / Réussite » sur la fiche élu ; réussite = le résultat a suivi le vote
  (Pour→adopté / Contre→rejeté), global + par thème. Calcul live dans `profilDepute` (via `sort_code`).
- Dissidences, votants, listes par thème/position, écran Thèmes, À propos, **barre d'onglets** en bas.

## Design system (refonte « app moderne » faite)
- `app/src/theme.ts` : palette **neutre** (encre `#171A1F` + gris froid `#F2F4F7`), accent ardoise
  `#3C4654`, **vote en tons sourds** (pour `#4F9D83`, contre `#CC715E`, abst `#D6A24B`, absent gris).
  Police **Manrope** (`@expo-google-fonts/manrope`, helper `F`). Tokens RADIUS, `shadowCard`.
- `app/src/categoryUI.ts` : icône (MaterialCommunityIcons) + teinte douce par thème.
- Icônes via `@expo/vector-icons`, anneaux via `react-native-svg`.

## Pièges de données (IMPORTANT)
- **Scrutins publics nominatifs uniquement** (la plupart des votes sont à main levée, absents).
- **Les absents n'apparaissent pas** → l'absence est **DÉDUITE** : `scrutins du thème (période) −
  votes exprimés`. La participation est **basse pour tous** (~25% médian) → affichée en **relatif**.
  Calcul dans `pipeline/src/participation.ts` (colonne `deputes.participation_rate`).
- `sort_code` : « **n'a pas adopté** » contient « adopté » → géré (négation) dans `parseScrutins.ts`.
- **Classification** thématique (12 catégories neutres, `pipeline/src/categories.ts`) : mots-clés en
  **mots entiers** + **propagation** aux amendements ; ~40% non classés (assumé). Hybride IA = plus tard.
- **Exposé d'amendement** : jointure heuristique date+numéro+auteur (~91%), `pipeline/src/linkAmendements.ts`.

## Backlog
- ~~Taux de réussite~~ ✅ FAIT (lentille publique sur la fiche élu).
- Brancher **Claude API** pour la classification hybride (pas encore de clé Anthropic).
- **Mise en ligne** : SQLite→Supabase + build stores (réglerait l'accès téléphone).

## Reste à faire côté design (mineur)
- Le sélecteur segmenté `Tous · Pour · Contre…` sur le détail d'un thème (optionnel : les cases
  cliquables couvrent déjà le besoin). Sinon la refonte visuelle est faite.
