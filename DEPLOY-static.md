# Déploiement — architecture 100 % statique (Cloudflare Pages)

Scrutoir est servi en **statique** : la base SQLite est pré-générée en ~8 000 fichiers
JSON, et l'ensemble est déposé sur **DEUX projets Cloudflare Pages** (gratuit, egress
gratuit, pas de serveur always-on) — le plafond de **20 000 fichiers s'applique PAR
projet**, et un projet unique saturait fin 2026 (~2 fichiers par scrutin) :

- **`scrutoir`** (scrutoir.fr) : l'app web (PWA) + les pages SEO pré-rendues, SANS `/data`.
- **`scrutoir-data`** (data.scrutoir.fr) : les JSON `/data/**` seulement, servis avec
  CORS ouvert (`app/data-project/_headers`). L'app les lit via `EXPO_PUBLIC_DATA_BASE`
  (bakée au build) ; le SW les met en cache (`DATA_ORIGINS` dans `app/public/sw.js`) ;
  l'ancienne URL `scrutoir.fr/data/**` redirige en 301 (`_redirects`) pour les clients
  pré-migration.

**Aucun Worker / D1 / R2.** L'API Express (`api/`) est **dev-only** (non déployée).

## Vue d'ensemble du pipeline de déploiement

```
pipeline/  npm run ingest:refresh    # Open Data AN → data/votes.db (ETag conditionnel)
pipeline/  npm run export:static     # votes.db → app/public/data/*.json (+ version.json)
app/       npm run build:web         # expo export -p web + patch PWA + pages SEO → app/dist/
app/       check-data-freshness.mjs  # garde anti-régression (version.json local vs prod)
app/       split-data-site.mjs       # dist/data → .data-site/ (+ _headers CORS)
wrangler   pages deploy app/.data-site --project-name=scrutoir-data   # 1/2 : les données
wrangler   pages deploy app/dist       --project-name=scrutoir        # 2/2 : l'app
```
L'ordre importe : **les données d'abord** (les pages SEO du site app référencent des
scrutins qui doivent déjà exister côté data).

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
  npm run deploy:pages   # garde anti-régression des données + wrangler pages deploy (bypass : -- --force)
  # (wrangler demandera de te connecter à Cloudflare au 1er lancement)
  ```

### 5. (Plus tard) Domaine `scrutoir.fr`
Pages → projet `scrutoir` → **Custom domains** → ajouter `scrutoir.fr`
(une fois le nom sécurisé : INPI cl. 9 & 42 + domaine).

### 6. Projet données « scrutoir-data » (à faire une fois — plafond 20 000 fichiers)
1. Dashboard → **Workers & Pages** → **Create application › Pages › Direct Upload** →
   nom **`scrutoir-data`** (doit matcher `--project-name=scrutoir-data` du workflow).
   Alternative CLI : `npx wrangler pages project create scrutoir-data --production-branch=main`.
2. Projet `scrutoir-data` → **Custom domains** → ajouter **`data.scrutoir.fr`**
   (le domaine étant déjà sur Cloudflare, le CNAME est posé automatiquement).
3. C'est tout : le token API existant (permission Pages › Edit au niveau du compte)
   couvre le nouveau projet. Au prochain run du workflow, les données partent sur
   `scrutoir-data` et l'app (sans `/data`) sur `scrutoir`.

⚠️ À faire **avant** de merger/lancer le workflow modifié : le build bake
`EXPO_PUBLIC_DATA_BASE=https://data.scrutoir.fr` — si le projet ou le domaine n'existe
pas, l'app déployée ne trouvera pas ses données (le SW accepte aussi le repli
`https://scrutoir-data.pages.dev`, changer la variable dans `refresh.yml` si besoin).

## Détails techniques

- **Limites Pages** : 20 000 fichiers **par projet** (d'où la séparation app / data —
  chaque projet garde ainsi des années de marge), 25 Mio/fichier (les JSON sont petits ;
  le modèle sémantique est découpé en parts, cf. `strip-model-for-pages.mjs`). Le dossier
  `app/public/data/` (~370 Mo) est **git-ignoré** et régénéré à chaque build.
  `prerender-seo.mjs` compte les fichiers des deux projets et bloque le build en cas de
  dépassement.
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
