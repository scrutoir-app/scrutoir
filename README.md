# Votes AN — ce que votent réellement les députés

Application qui permet de chercher un·e député·e et de voir **ce qu'il/elle a réellement
voté**, ventilé par grandes catégories thématiques (Écologie, Sécurité, Santé…), à partir
des données Open Data de l'Assemblée Nationale (17ᵉ législature).

> Objectif : confronter le discours et les actes. On affiche, par catégorie et par période,
> le détail Pour / Contre / Abstention / Absent — sans score agrégé trompeur.

## Architecture

```
pipeline/   Ingestion Open Data AN → base de données (Node + TypeScript + SQLite)
api/        API HTTP locale au-dessus de la base (Express)
app/        Application mobile Expo (React Native, iOS + Android + Web)
data/       Base votes.db + archives brutes (ignoré par git)
```

## Lancer l'app (3 terminaux)

```bash
# 1. (une fois) charger les données
cd pipeline && npm install && npm run ingest

# 2. l'API
cd api && npm install && npm start          # http://localhost:4000

# 3. l'app
cd app && npm install && npm run web         # http://localhost:8081
#   ou: npm run ios / npm run android / Expo Go sur ton téléphone
```

Sur téléphone (Expo Go), remplace `localhost` par l'IP LAN de ton Mac dans
`app/src/api.ts` (ou via la variable `EXPO_PUBLIC_API_BASE`).

## Lancer l'API

```bash
cd api
npm install
npm start            # http://localhost:4000
```

Endpoints :
- `GET /search?q=…` — recherche unifiée députés + scrutins
- `GET /deputes/:uid?periode=all|12m|6m` — profil de vote + loyauté au groupe
- `GET /scrutins/:uid` — détail d'un scrutin (ventilation par groupe + consigne)
- `GET /scrutins/:uid/vote/:deputeUid` — vote précis + conformité à la consigne
- `GET /categories` — liste des catégories

## Indicateur de loyauté

L'AN fournit la `positionMajoritaire` (consigne) de chaque groupe par scrutin.
La loyauté d'un·e député·e = % de ses votes exprimés conformes à la consigne de son
groupe. Validé : discrimine de ~72 % (les plus indépendants) à ~99 % (cadres de groupe).

La base est en **SQLite** pour le prototype (zéro compte, zéro Docker). Le schéma est
relationnel pur et **portable vers Postgres / Supabase** pour la mise en ligne.

## Source des données

Open Data Assemblée Nationale (licence Etalab, mise à jour quotidienne) :

- **Scrutins** : `repository/17/loi/scrutins/Scrutins.json.zip` — position nominative de
  chaque député pour chaque scrutin public.
- **Acteurs & Organes** : `repository/17/amo/.../AMO10_...json.zip` — députés actifs,
  mandats, groupes politiques.
- **Photos** : `www2.assemblee-nationale.fr/static/tribun/17/photos/{id}.jpg`.

⚠️ Seuls les **scrutins publics** sont nominatifs (les votes à main levée ne le sont pas).

## Modèle de données

`groupes`, `deputes`, `scrutins`, `votes` (position de chaque député par scrutin),
`categories`, `scrutin_categories` (association thématique avec `source` =
`mots-cles | ia | valide` pour la classification hybride).

## Classification thématique

Aucune catégorie n'est fournie par l'AN — on les calcule. Deux niveaux :

1. **Mots-clés** (`src/categories.ts`) — fallback déterministe, sans clé API. Actif par défaut.
2. **IA (Claude)** — branchable via `ANTHROPIC_API_KEY`, avec mise en file des cas
   ambigus pour **validation humaine** (les lignes `source='valide'` sont prioritaires et
   jamais écrasées).

## Lancer le pipeline

```bash
cd pipeline
npm install
npm run ingest            # télécharge (si besoin) + charge + classe
npm run ingest:download   # force le re-téléchargement (données du jour)
npm run query -- "Panot"  # profil de vote d'un député (validation)
```

## État actuel

✅ Pipeline d'ingestion complet : 577 députés, 12 groupes, 7422 scrutins, ~1,15 M de
votes, classification thématique (12 catégories), consignes de groupe.
✅ API HTTP : recherche députés+scrutins, profil avec loyauté, détail de scrutin.
✅ App mobile Expo : 3 écrans fonctionnels (recherche / fiche député / détail scrutin),
vérifiés sur données réelles.

## Pistes suivantes

- Améliorer la classification (affiner les mots-clés ou brancher Claude API en hybride).
- Lister les « dissidences » d'un·e député·e (scrutins votés contre la consigne).
- Filtrer/parcourir les scrutins par catégorie.
- Mise en ligne : migration SQLite → Supabase (Postgres) + build iOS/Android.
