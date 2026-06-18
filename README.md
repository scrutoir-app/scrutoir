# Votes AN — ce que votent réellement les députés

Application qui permet de chercher un·e député·e et de voir **ce qu'il/elle a réellement
voté**, ventilé par grandes catégories thématiques (Écologie, Sécurité, Santé…), à partir
des données Open Data de l'Assemblée Nationale (17ᵉ législature).

> Objectif : confronter le discours et les actes. On affiche, par catégorie et par période,
> le détail Pour / Contre / Abstention / Absent — sans score agrégé trompeur.

## Architecture

```
pipeline/   Ingestion Open Data AN → base de données (Node + TypeScript + SQLite)
api/        (à venir) API HTTP locale au-dessus de la base
app/        (à venir) Application mobile Expo (React Native, iOS + Android)
data/       Base votes.db + archives brutes (ignoré par git)
```

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

✅ Pipeline d'ingestion complet et validé : 577 députés, 12 groupes, 7422 scrutins,
~1,15 M de votes individuels, classification thématique (12 catégories).
🔜 API HTTP + application mobile Expo.
