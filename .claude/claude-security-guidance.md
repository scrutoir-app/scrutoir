# Scrutoir — règles de sécurité et de confidentialité

App Expo / React Native Web, servie en statique (Cloudflare Pages). Les données de
l'Assemblée sont publiques. Les données de l'utilisateur, elles, ne doivent jamais
quitter son appareil.

## Données sensibles (RGPD art. 9)

Sont des opinions politiques, donc des données sensibles au sens de l'article 9 du RGPD :

- les réponses Pour / Contre / Sans avis du test de proximité (type `Reponse`,
  `EtatTest.reponses`) ;
- les poids de thèmes choisis par l'utilisateur (`EtatTest.poids`) ;
- tout ce qui en est dérivé : spectre de proximité, score par groupe ou par député,
  groupe le plus proche, verdict « comme toi ».

## Règles

1. **Stockage sur l'appareil uniquement.** Ces données ne sont persistées que via
   `app/src/testProximite/storage.ts` (clé localStorage `scrutoir.test-proximite`).
   Aucun autre module ne les écrit ailleurs.
2. **Aucune sortie.** Elles ne doivent apparaître dans aucun appel réseau (`fetch`,
   `navigator.sendBeacon`, XHR, WebSocket, query string, en-tête, corps), aucun appel à
   `track()` de `app/src/analytics.ts`, aucun `console.*`, aucun rapport de crash, aucun
   SDK tiers. Ça vaut aussi pour les fuites indirectes : un événement analytics déclenché
   automatiquement à partir d'un résultat de score transmet ce résultat. Exemple :
   `toggleFollow()` (`app/src/follows.ts`) émet `track("follow_parti", uid)`. L'appeler sur
   le groupe le plus proche envoie donc le résultat du test.
3. **Calcul côté client.** Le score de proximité est calculé dans
   `app/src/testProximite/score.ts` (et `jeProximite.ts`, `verdict.ts`). Ne jamais le
   déplacer vers un serveur, un Worker, une API ou un service distant.
4. **Signaler avant d'ajouter.** Tout nouvel appel réseau ou nouvel hôte (à refléter dans
   `connect-src` de `app/public/_headers`), tout SDK tiers (analytics, crash reporting, A/B,
   pub, auth, notifications), toute dépendance qui touche au stockage (AsyncStorage,
   SecureStore, wrappers IndexedDB, synchro cloud) doit être signalé comme finding avant
   d'être accepté.
5. **Aucun secret en dur.** Aucune clé API, aucun token, aucun mot de passe dans le code ou
   le bundle. Toute variable `EXPO_PUBLIC_*` est embarquée dans le bundle public : n'y
   mettre que des valeurs publiques. Les secrets CI passent par les GitHub secrets, ceux du
   Worker analytics par `wrangler secret put` (`analytics/.dev.vars` est gitignoré).

## Sévérité attendue

- **High** : une donnée de la liste ci-dessus atteint le réseau, un log ou un SDK tiers,
  y compris via un événement analytics, une URL avec `?`, un raccourcisseur de lien ou un
  stockage distant. Également : un secret en dur, un secret dans `EXPO_PUBLIC_*`.
- **Medium** : un nouvel hôte réseau, un nouveau SDK tiers ou une nouvelle dépendance de
  stockage ajoutés sans mention explicite dans la PR.
- Le partage par lien (`urlPartage`, hash `#test=`) existe déjà. Son statut est en cours
  d'arbitrage. Toute modification qui élargit ce qui sort de l'appareil par ce biais est
  High.

## Ce qui est déjà conforme (ne pas signaler)

- `track("screen", nom)` n'envoie que le nom de la route, sans paramètre.
- Les appels à `geo.api.gouv.fr` (recherche de commune, géolocalisation) n'envoient ni
  réponse ni score.
- Le modèle de recherche sémantique est auto-hébergé (`allowRemoteModels = false`).
