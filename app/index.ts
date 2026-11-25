import { registerRootComponent } from 'expo';

import { demarrerMesure } from './src/arrivee';
import { importerTransfertDeLAdresse } from './src/transfertAdresse';
import App from './App';

// Mesure d'audience (web) : `?mesure=on|off`, puis une arrivée par visite (provenance en liste
// fermée), puis `via`/`source`/`mesure` retirés de l'adresse. Avant le premier rendu, donc avant
// le premier `track("screen")`. Sans effet hors navigateur.
demarrerMesure();

// Lien de transfert ouvert (`#transfert=`, « Copier et installer ») : import sur l'appareil, puis
// hash retiré de l'adresse. Avant le premier rendu : l'onboarding voit les réponses importées.
importerTransfertDeLAdresse();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
