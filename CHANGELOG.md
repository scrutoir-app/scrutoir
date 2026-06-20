# Journal des versions — Scrutoir

Versionnage [semver](https://semver.org/lang/fr/) : MAJEUR.MINEUR.CORRECTIF.
La version est affichée en bas de l'écran **Infos** de l'app (à citer avec les retours utilisateurs).

> Procédure de release : incrémenter `APP_VERSION` dans `app/src/config.ts`, ajouter une
> entrée ici, puis déployer (`npm run build:web` + `wrangler pages deploy`). Bumper aussi
> `SHELL_VERSION` dans `app/public/sw.js` si on veut forcer le rafraîchissement de la coquille.

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
