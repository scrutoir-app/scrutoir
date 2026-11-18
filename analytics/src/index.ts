/**
 * scrutoir-analytics — analytics « maison », privacy-first.
 *
 * - POST /collect : reçoit un événement anonyme → Cloudflare Analytics Engine.
 *   AUCUN cookie, AUCUNE IP stockée, AUCUN identifiant. On ne stocke que : type d'événement +
 *   entité + extra + classe d'appareil (collecte.ts). Pour `share` et `arrivee`, entité et extra
 *   viennent de listes fermées (app/src/mesureListes.ts), toute autre valeur devient « autre ».
 * - GET /stats : tableau de bord privé (mot de passe HTTP Basic = DASH_KEY), une page sans
 *   script qui tient sur un écran (tableau.ts), lue en SQL dans Analytics Engine (donnees.ts).
 *
 * AUTO-ÉVOLUTIF : tout type d'événement accepté par `EVENTS` (collecte.ts) et absent des
 * chiffres clés et des onglets apparaît seul dans l'onglet « Autres ». Libellé : `META`
 * (tableau.ts).
 *
 * Secrets (wrangler secret put) : CF_API_TOKEN (Account Analytics:Read), DASH_KEY (mdp).
 * Aperçu local avec des données fictives : `npx wrangler dev src/demo.ts` (cf. demo.ts).
 */

import { collecter } from "./donnees";
import { servir } from "./serveur";
import type { Ecrivain } from "./collecte";
import type { Jalon } from "./tableau";

/**
 * Repères du graphique d'activité : un lancement, un changement qui peut faire bouger les
 * chiffres. À compléter au fil de l'eau (date AAAA-MM-JJ, libellé court).
 */
export const JALONS: Jalon[] = [
  { date: "2026-11-09", libelle: "Partage du spectre en story" },
  // Date de mise en service de la v1.43.0 (déploiement du Worker et de l'appli) : à corriger si
  // le déploiement a lieu un autre jour.
  { date: "2026-11-18", libelle: "Mesure des partages" },
];

interface Env {
  AE: Ecrivain;
  CF_ACCOUNT_ID: string;
  DATASET: string;
  ALLOWED_ORIGINS: string;
  CF_API_TOKEN: string;
  DASH_KEY: string;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return servir(request, env, (jours) => collecter(env, jours), JALONS);
  },
};
