#!/usr/bin/env bash
# Régénère les icônes de l'app (iOS, Android adaptative, favicon, PWA) et les exports de marque
# sombres. Depuis la 1.37.0 (logo citron sur fond sombre), tout vient de gen-marque-sombre.mjs,
# qui dessine depuis la géométrie de src/components/brand/geometrie.ts (plus de `sips` depuis
# assets/icon.png). Les fichiers générés sont committés (pas régénérés dans la CI quotidienne).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/gen-marque-sombre.mjs
