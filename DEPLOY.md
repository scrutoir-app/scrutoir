# Mettre Hémicycle en ligne (pour y accéder depuis le téléphone)

L'accès en réseau local est bloqué (pare-feu macOS + McAfee). La solution : héberger
l'app, et ouvrir une **URL** depuis le téléphone.

## Architecture
Un **seul service Node** (dossier `api/`) sert à la fois :
- le **web exporté** (`app/dist`, en même origine → l'app appelle l'API en relatif) ;
- l'**API** (`/search`, `/deputes/:uid`, `/confrontation`, `/circonscription`, …).

La base `votes.db` (~174 Mo) est **trop grosse pour git** : elle est **téléchargée au
démarrage** depuis `DB_URL` (un asset de Release GitHub) vers `DB_PATH` (`/tmp/votes.db`).

## Étapes (Render, gratuit, sans Docker)

1. **Pousser le repo sur GitHub** (sans la base, elle est git-ignorée).
   `git remote add origin <ton-repo>` puis `git push -u origin main`.

2. **Héberger la base** : sur GitHub → *Releases* → *Draft a new release* →
   glisser `data/votes.db` en *asset* → publier. Copier l'URL directe de l'asset
   (clic droit sur le fichier → « Copier le lien »), ex.
   `https://github.com/<toi>/<repo>/releases/download/v1/votes.db`.

3. **Créer le service sur Render** (https://render.com, compte gratuit) :
   - *New* → *Blueprint* → connecter le repo (il lit `render.yaml`).
   - Renseigner la variable **`DB_URL`** = l'URL de l'asset (étape 2).
   - Déployer. (Le port est fourni automatiquement par Render.)

4. **Ouvrir l'URL** `https://hemicycle.onrender.com` (ou celle attribuée) **sur le
   téléphone**, dans Safari/Chrome. C'est l'app.

## Notes
- **Démarrage à froid** (offre gratuite Render) : le service s'endort après ~15 min
  d'inactivité ; au réveil il re-télécharge la base (~174 Mo) → premier chargement
  un peu long, puis rapide. Pour éviter ça : offre payante avec disque persistant.
- **Mettre à jour le web** après un changement d'app :
  `cd app && EXPO_PUBLIC_API_BASE="" npx expo export -p web` puis committer `app/dist`.
- **Mettre à jour les données** : relancer `npm --prefix pipeline run ingest`, puis
  re-téléverser `data/votes.db` dans une nouvelle Release et mettre à jour `DB_URL`.
- **Test en local du rendu déployé** : `PORT=4000 npm --prefix api start` puis ouvrir
  `http://localhost:4000` (sert web + API en même origine, sans `DB_URL` → base locale).
