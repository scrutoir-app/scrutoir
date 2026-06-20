#!/usr/bin/env bash
# Régénère les photos d'illustration des thèmes dans app/public/hero/ depuis Unsplash
# (licence Unsplash : usage libre, y compris commercial). Self-hébergées pour fiabilité,
# vie privée (aucun appel externe côté utilisateur) et fonctionnement hors-ligne.
# Les ids sont lus directement dans src/categoryUI.ts. Utilise `sips` (natif macOS).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/hero
ids=$(grep -oE "photo-[0-9]+-[a-z0-9]+" src/categoryUI.ts | sort -u)
n=0
for id in $ids; do
  curl -sL "https://images.unsplash.com/${id}?w=1200&q=70&fm=jpg&fit=crop" -o "/tmp/_hero_$id.jpg"
  sips -Z 1000 -s formatOptions 65 "/tmp/_hero_$id.jpg" --out "public/hero/${id}.jpg" >/dev/null
  rm -f "/tmp/_hero_$id.jpg"
  n=$((n+1))
done
echo "$n images générées dans public/hero/"
