# Scrutoir — ce que votent réellement les députés

Application web citoyenne, **neutre, gratuite et sans publicité**, qui rend lisibles les
**votes réels des député·e·s** à l'Assemblée nationale (17ᵉ législature), à partir de l'Open
Data officiel. Objectif : confronter le discours et les actes — **aucune couleur de parti
n'est mise en avant, seul le vote parle.**

🟢 **En ligne : [scrutoir.fr](https://scrutoir.fr)** (PWA installable, fonctionne hors-ligne).

## Fonctionnalités

- **Recherche** de député·e·s, de partis et de scrutins.
- **Fiche élu·e** : participation relative, votes par thème (Pour / Contre / Abstention /
  Absent · Non votant), dissidences, consigne du groupe par scrutin. *Pas de score de loyauté
  agrégé* (jugé trompeur) — on montre l'écart à la consigne, à vous de lire.
- **Détail d'un scrutin** : résultat, exposé de l'amendement, position par groupe, votants,
  lien vers la source officielle.
- **Confrontation de deux élu·e·s** : accords / désaccords par thème (barres divergentes),
  avec page détaillée filtrable par année/mois.
- **Fiches partis** (cohésion, participation, activité, positions par thème), **« Mon·ma
  député·e »** (département → circonscription), onglet **Suivis**.
- **Accueil** : carrousel « signature » animé des derniers grands scrutins + indicateur de
  fraîcheur des données.
- **Mode clair / sombre / auto** (⚙️ Paramètres).

## Architecture (100 % statique)

Pas de serveur en production : la base est pré-générée en fichiers JSON servis en statique.

```
pipeline/   Ingestion Open Data AN → SQLite (data/votes.db) → export JSON (Node + TypeScript)
app/        Application Expo / React Native (web + iOS + Android). Lit les JSON pré-générés.
api/        API Express — DÉVELOPPEMENT LOCAL UNIQUEMENT (non déployée).
data/       votes.db + archives brutes (ignoré par git)
```

- **Données** : `pipeline` (`npm run ingest:refresh` + `npm run export:static`) dump ~8 000
  fichiers JSON dans `app/public/data/` (git-ignoré, régénéré). `app/src/api.ts` les lit.
- **Hébergement** : **Cloudflare Pages** (gratuit). Déploiement quotidien automatique via
  GitHub Actions (`.github/workflows/refresh.yml`) — voir **[DEPLOY-static.md](DEPLOY-static.md)**.
- **Versionnage** : `app/src/config.ts` (`APP_VERSION`) + **[CHANGELOG.md](CHANGELOG.md)**.

## Lancer en local (dev)

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"        # Node via nvm
cd pipeline && npm install && npm run ingest && npm run export:static   # base + JSON
cd ../app && npm install && npm run web                 # http://localhost:8081
```

L'API Express (`api/`) reste disponible pour le dev mais n'est **pas** nécessaire à l'app web
(qui lit les JSON statiques). Détails et pièges : **[CLAUDE.md](CLAUDE.md)** (handoff technique).

## Source des données

Open Data de l'Assemblée nationale (licence Etalab, mise à jour quotidienne), 17ᵉ législature :
scrutins publics nominatifs, acteurs/organes (députés, groupes, mandats), amendements.

⚠️ **Seuls les scrutins publics sont nominatifs** — les votes à main levée ne le sont pas et
n'apparaissent pas. L'absence est *déduite* et bornée aux dates du mandat. La classification
thématique (12 catégories) est calculée automatiquement à partir de l'intitulé (donc imparfaite).

## Limites & vie privée

Données non officielles, à titre informatif, à lire avec nuance. Aucun compte requis, aucune
donnée personnelle collectée ; mesure d'audience anonyme et agrégée. Détail dans l'app
(onglet **Infos** → « À propos & limites » + mentions légales).
