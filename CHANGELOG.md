# Journal des versions — Scrutoir

Versionnage [semver](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.
La version est affichée en bas de l'écran **Infos** de l'app (à citer avec les retours utilisateurs).

> Procédure de release : incrémenter `APP_VERSION` dans `app/src/config.ts`, ajouter une
> entrée ici, puis déployer (`npm run build:web` + `wrangler pages deploy`). Bumper aussi
> `SHELL_VERSION` dans `app/public/sw.js` si on veut forcer le rafraîchissement de la coquille.

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
