# Déploiement — architecture 100 % statique (Cloudflare Pages)

Scrutoir est servi en **statique** : la base SQLite est pré-générée en ~8 000 fichiers
JSON, et l'app web (PWA) + ces JSON sont déposés sur **Cloudflare Pages** (gratuit,
egress gratuit, pas de serveur always-on). **Aucun Worker / D1 / R2.** L'API Express
(`api/`) devient **dev-only** (cf. `DEPLOY.md` et `render.yaml`, désormais **obsolètes**).

## Vue d'ensemble du pipeline de déploiement

```
pipeline/  npm run ingest:refresh   # Open Data AN → data/votes.db (ETag conditionnel)
pipeline/  npm run export:static     # votes.db → app/public/data/*.json (+ version.json)
app/       npm run build:web         # expo export -p web + patch PWA → app/dist/
                                      #   (copie public/ → dist/ : data, manifest, sw.js,
                                      #    icons, _headers, _redirects)
wrangler   pages deploy app/dist      # → https://scrutoir.pages.dev
```

Tout est automatisé quotidiennement par **`.github/workflows/refresh.yml`** (cron 05:10 UTC
+ lancement manuel). L'AN publie un dump complet → la ré-ingestion est **idempotente**.

## Étape 5 — Mise en place (à faire une fois, via TES comptes)

> Ces étapes passent par tes comptes **Cloudflare** et **GitHub**. Rien n'est déployé
> sans ta validation.

### 1. Créer le projet Cloudflare Pages
- Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** →
  **Direct Upload** (PAS l'intégration Git : on déploie via GitHub Actions + wrangler).
- Nom du projet : **`scrutoir`** (doit matcher `--project-name=scrutoir` du workflow).
- → URL : `https://scrutoir.pages.dev`.

### 2. Récupérer les identifiants Cloudflare
- **Account ID** : Dashboard → Workers & Pages → barre latérale droite (« Account ID »).
- **API Token** : Mon profil → **API Tokens** → **Create Token** → template
  **« Edit Cloudflare Workers »** OU token custom avec la permission
  **Account › Cloudflare Pages › Edit**. Copier le token (affiché une seule fois).

### 3. Ajouter les secrets GitHub
Dépôt GitHub → **Settings › Secrets and variables › Actions › New repository secret** :
- `CLOUDFLARE_API_TOKEN` = le token ci-dessus
- `CLOUDFLARE_ACCOUNT_ID` = l'account id ci-dessus

### 4. Premier déploiement
Deux options :
- **Manuel (recommandé pour le 1er coup)** : onglet **Actions** → workflow
  « Refresh quotidien → Cloudflare Pages » → **Run workflow**. Vérifier les logs.
- **En local** (depuis ta machine, après un build) :
  ```bash
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
  cd pipeline && npm run ingest:refresh && npm run export:static
  cd ../app && npm run build:web
  npx wrangler pages deploy dist --project-name=scrutoir
  # (wrangler demandera de te connecter à Cloudflare au 1er lancement)
  ```

### 5. (Plus tard) Domaine `scrutoir.fr`
Pages → projet `scrutoir` → **Custom domains** → ajouter `scrutoir.fr`
(une fois le nom sécurisé : INPI cl. 9 & 42 + domaine).

## Détails techniques

- **Limites Pages** : 20 000 fichiers / déploiement (on est à ~8 000 + assets), 25 Mo/fichier
  (les JSON sont petits). Le dossier `app/public/data/` (~370 Mo) est **git-ignoré** et
  régénéré à chaque build (jamais committé).
- **PWA** : `manifest.json` + `sw.js` (SW vanilla) injectés dans `dist/index.html` par
  `app/scripts/patch-pwa.mjs` (lancé par `npm run build:web`). Installable + offline.
- **Cache** :
  - `app/public/_headers` règle le cache CDN (immuable pour `/_expo/static/*` et
    `/data/scrutin/*` ; revalidation pour la coquille, le SW et les données mutables).
  - Le **service worker** gère les visites répétées en PWA (network-first coquille,
    cache-first bundle + scrutins, stale-while-revalidate données mutables).
  - `data/version.json` (timestamp + compteurs) sert de point de détection d'un nouveau
    déploiement (lu en network-first par le SW).
- **Téléchargement conditionnel** : `npm run ingest:refresh` envoie `If-None-Match` (ETag,
  sidecar `data/raw/*.etag`) → le gros `Amendements.json.zip` (~270 Mo) n'est re-téléchargé
  que s'il a changé. La CI persiste `data/raw` via `actions/cache` pour profiter du 304.

## Dév local (inchangé)

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
cd pipeline && npm run ingest && npm run export:static   # base + JSON statiques
cd ../app && npm run web                                  # Expo web :8081 (sert public/)
```
Pour tester le **build de prod** (PWA + SW) en local : `npm run build:web` puis servir
`app/dist/` en HTTP (ex. `python3 -m http.server 8099 --directory dist`) — le SW exige
une origine http(s)/localhost.
