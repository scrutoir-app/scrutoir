# Audit SEO & feuille de route — Scrutoir

> Périmètre validé : **SEO organique** (acquisition gratuite). Pas de budget SEA payant ;
> Google Ads ne resterait pertinent que via **Ad Grants**, conditionné à une structure
> associative (voir §6). Audit rédigé avant implémentation, sur l'état du code au 23/06/2026.

---

## 1. Résumé exécutif

**Verdict : le SEO de Scrutoir est aujourd'hui à ~0, pour des raisons d'architecture, pas de contenu.**
L'app est une PWA React Native Web à rendu 100 % client, sans URL par contenu. Google ne peut
indexer qu'une page (l'accueil). Or Scrutoir possède un gisement de contenu rare et à forte
intention de recherche (votes réels, nominatifs, neutres).

**Le potentiel, chiffré :**

| Type de contenu | Volume | Pages indexables potentielles |
|---|---:|---|
| Scrutins | 7 422 | 7 422 |
| Députés | 577 | 577 |
| Thèmes | 12 | 12 |
| Partis | 12 | 12 |
| **Socle** | | **≈ 8 023 pages** |
| Croisements députés × thèmes (phase 2) | | ≈ 6 900 (à activer prudemment, cf. §5) |

**Levier décisif :** les données sont **déjà statiques** (JSON pré-générés au build). Générer
de vraies pages HTML pré-rendues depuis ce JSON est peu risqué, ne nécessite pas de refondre
l'app, et débloque d'un coup la totalité du potentiel organique.

**Effort pour le socle (phase 1) :** modéré — un générateur build-time dans la lignée de
`patch-pwa.mjs`, sans toucher à la navigation en mémoire de l'app.

---

## 2. État des lieux (preuves dans le code)

### 2.1 Blocages bloquants

1. **Aucune URL par contenu.** `app/src/nav.ts` définit une pile de routes en mémoire
   (`nav.push({name:"depute", uid})`). Aucun `history.pushState`, aucun `pathname`,
   aucun lien profond. Députés, scrutins, thèmes vivent tous sur `https://scrutoir.fr/`.
2. **Rendu 100 % client.** Le `dist/index.html` servi contient un `<div id="root">` **vide** ;
   tout le contenu est peint par le bundle JS (~1,2 Mo) après chargement. Un crawler qui
   n'exécute pas le JS ne voit aucun contenu.
3. **Soft-404 généralisé.** `public/_redirects` finit par `/*  /index.html  200` : **n'importe
   quelle URL renvoie la home en HTTP 200**. Pour Google, c'est un signal de duplication massive
   (mille URL → même page) et de contenu non distinct.
4. **Pas de `robots.txt` ni de `sitemap.xml`.**
5. **Métadonnées uniques et globales.** Un seul `<title>` (« Scrutoir ») et une seule
   `<meta description>` pour toute l'app ; les balises Open Graph sont fixes (partage = toujours
   la home).

### 2.2 Atouts déjà en place (à exploiter)

- **Données 100 % statiques** prêtes à pré-rendre (`npm run export:static`).
- **Hébergement Cloudflare Pages** : les fichiers réels priment sur le catch-all `_redirects`
  (« Les assets existants priment toujours »). On peut donc déposer des pages HTML par contenu
  qui seront servies en direct, sans réécrire la règle 200.
- **CSP compatible** : `script-src 'self' 'unsafe-inline'` autorise le JSON-LD `schema.org`
  inline.
- **Fraîcheur de la donnée** : `version.json` (date de régénération) → alimente `lastmod` du sitemap.
- **Performance de base correcte** (statique + CDN), reste à surveiller le poids du bundle pour
  les Core Web Vitals des pages qui chargent l'app.

---

## 3. Le potentiel organique (à quoi on veut se positionner)

Requêtes à forte intention où Scrutoir serait une des rares sources **neutres, lisibles, sourcées** :

- **Nominatif député** : « comment a voté [Nom Prénom] », « [député] vote [loi/sujet] »,
  « positions [député] écologie / immigration / retraites ».
- **Scrutin / loi** : « résultat vote [intitulé de loi] », « qui a voté pour/contre [texte] ».
- **Thème** : « votes assemblée [écologie / sécurité / santé] 2024-2026 ».
- **Parti** : « comment vote le groupe [parti] », « cohésion [parti] assemblée ».
- **Comparaison** : « [député A] vs [député B] votes » (la fonction Confrontation).

Ces requêtes sont **longue traîne, peu concurrentielles, à intention claire** — le profil idéal
pour un site de données. La neutralité de Scrutoir est un différenciateur fort vs sites partisans.

---

## 4. Recommandations techniques

### 4.1 Décision d'architecture (deux options)

**Option A — Pages SSG statiques générées du JSON _(recommandée)_.**
Un script build-time (comme `patch-pwa.mjs`) émet une vraie page HTML par contenu :
`/depute/<slug>`, `/scrutin/<id>`, `/theme/<slug>`, `/parti/<slug>`. Chaque page contient le
contenu réel (rendu au build), ses propres meta + canonical + Open Graph + JSON-LD, et un
maillage interne. Elle coexiste avec la PWA et propose un CTA « ouvrir dans l'app ».
- ✅ Faible risque, pas de refonte de la nav en mémoire, livrable rapidement.
- ✅ Indépendant du bundle JS → indexable même sans exécution JS, Core Web Vitals excellents.
- ➖ Deux surfaces à maintenir (pages SEO + app), atténué car les deux dérivent du même JSON.

**Option B — Migration vers Expo Router (routing + static rendering natif).**
Une seule base, URLs natives, rendu statique par route.
- ✅ Consolidation à terme.
- ➖ Refonte lourde de la navigation actuelle (pile `nav.ts` → router fichiers), risque élevé,
  long. **Non prioritaire** ; à reconsidérer seulement si l'app a besoin de liens profonds
  pour d'autres raisons (partage, SEA).

➡️ **On part sur A.** B reste une consolidation possible plus tard.

### 4.2 Briques à livrer (socle SEO)

1. **Générateur de pages SSG** (un par type d'entité) depuis les JSON existants, branché dans
   le pipeline `build:web`/`export:static`.
2. **Métadonnées par page** : `<title>` et `<meta description>` uniques et templatés
   (ex. « Comment a voté [Nom] — [parti] | Scrutoir »), `<link rel="canonical">`, Open Graph/Twitter.
3. **Données structurées `schema.org` (JSON-LD)** : `Person` (députés), `Organization`/
   `Legislation` (partis/textes), `BreadcrumbList`, `WebSite` + `SearchAction` sur la home.
4. **`sitemap.xml`** généré (toutes les URLs, `lastmod` issu de `version.json`) ; segmenté si > 50 000 URLs.
5. **`robots.txt`** (autorise tout, référence le sitemap).
6. **Maillage interne** : député ↔ ses votes ↔ scrutins ↔ thème ↔ parti.
7. **Canonique du domaine** : forcer `www` → apex (ou l'inverse) — déjà au backlog projet.
8. **Garde-fou anti-soft-404** : vérifier que seules les vraies entités ont une page ; les URLs
   inconnues doivent faire un vrai 404 (le mécanisme `404.html` existe déjà).

---

## 5. Stratégie de contenu (éviter le piège du « thin content »)

8 000+ pages d'un coup, si elles sont pauvres ou quasi identiques, déclenchent un filtre Google
(contenu de faible valeur auto-généré). **On phase et on enrichit :**

- **Phase A — pages riches, à fort signal d'abord** : 577 députés + 12 thèmes + 12 partis +
  les « grands scrutins ». Contenu dense et unique par nature (votes, dissidences, consigne de groupe).
- **Phase B — déploiement progressif des 7 422 scrutins**, chacun avec son contenu propre
  (intitulé, exposé d'amendement, décompte, répartition par groupe). Légitime car réellement unique.
- **Phase C (optionnelle) — croisements** député × thème : seulement là où il y a assez de
  matière (≥ N scrutins), sinon `noindex`. Ne jamais générer 6 900 pages vides.
- **Règle d'or** : chaque page indexée doit apporter une donnée que les autres n'ont pas.
  En cas de doute → `noindex, follow` (la page existe pour l'utilisateur mais ne pollue pas l'index).

**Cohérence ligne éditoriale :** garder la neutralité (jamais de couleur de parti, seul le vote
parle) jusque dans les titres/descriptions. C'est aussi un atout E-E-A-T (sources officielles
Open Data AN citées sur chaque page).

---

## 6. SEA / Ad Grants (vu le choix « gratuit »)

- **Pas de pub payante** au programme : on ne plache pas de campagnes Google Ads classiques.
- **Google Ad Grants** = 10 000 $/mois d'annonces Search offertes, **réservé aux associations**
  éligibles. Scrutoir étant édité par **Seedger** (société), ce serait conditionné à la création
  d'une **structure à but non lucratif** portant le projet. À trancher hors-tech (juridique).
- ⚠️ **À vérifier avant tout SEA, même gratuit** : Google encadre fortement la **publicité à
  caractère politique** en France/UE (vérification d'identité annonceur ; règlement européen TTPA
  sur la transparence de la publicité politique). Un service civique neutre qui nomme des élus
  peut tomber dans des règles spécifiques. *(À confirmer via recherche web à jour — non affirmé ici.)*
- **Conclusion** : SEA mis de côté ; si l'angle associatif se concrétise un jour, on rouvrira le
  sujet (Ad Grants + vérif politique). D'ici là, **100 % de l'effort sur l'organique.**

---

## 7. Feuille de route priorisée

| # | Lot | Contenu | Dépend de | Priorité |
|---|---|---|---|---|
| **1** | Fondations crawl | `robots.txt`, `sitemap.xml` (socle), canonique domaine | — | ✅ **Livré (v1.0.48)** |
| **2** | SSG socle | Générateur + pages **députés / thèmes / partis / grands scrutins** avec meta + JSON-LD + maillage | 1 | ✅ **Livré (v1.0.49)** — 681 pages |
| **3** | Mesure | Google Search Console (propriété + sitemap soumis), suivi indexation | 1-2 | 🔴 Haute (à faire) |
| **4** | SSG scrutins | Déploiement progressif des 7 422 scrutins | 2 | 🟠 Moyenne |
| **5** | Enrichissement | Optimisation titres/descriptions selon données GSC, FAQ/contenu d'appui | 3-4 | 🟠 Moyenne |
| **6** | Croisements | Pages député × thème (avec seuil + `noindex` sinon) | 4 | 🟢 Basse |
| **7** | Consolidation | (Optionnel) routing in-app / Expo Router pour liens profonds | — | 🟢 Basse |

**Premier pas concret recommandé :** lot 1 + 2 (Phase A). C'est ce qui transforme Scrutoir
d'« une page indexable » en « ~600 pages riches indexables », avec un risque technique faible.

---

## 8. Mesure du succès (KPI)

- **Indexation** : nombre d'URLs indexées (Search Console) — l'indicateur n°1 au démarrage.
- **Couverture** : % de pages soumises effectivement indexées (qualité du contenu).
- **Impressions & clics organiques** par type (député / scrutin / thème) via GSC.
- **Position moyenne** sur les requêtes nominatives cibles.
- **Core Web Vitals** des pages SSG (doivent être excellents, car statiques et légères).
- **Trafic organique** (analytics maison, déjà en place, sans cookie).

---

### Annexe — chiffres relevés (23/06/2026)

- 7 422 scrutins · 577 députés · 12 thèmes · 12 partis (`app/public/data/`).
- Bundle JS web ≈ 1,2 Mo.
- Aucun `robots.txt`/`sitemap.xml` ; `_redirects` se termine par `/* /index.html 200`.
- CSP autorise le JSON-LD inline (`script-src 'self' 'unsafe-inline'`).
