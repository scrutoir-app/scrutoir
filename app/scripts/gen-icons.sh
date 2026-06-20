#!/usr/bin/env bash
# Génère les icônes PWA dans public/icons/ depuis assets/icon.png (1024×1024).
# Utilise `sips` (natif macOS, pas de Homebrew/sharp). À relancer si l'icône de
# marque change. Les icônes générées sont committées (assets statiques, pas
# régénérées dans la CI quotidienne).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=assets/icon.png
BG=F2F4F7  # fond de marque (theme.ts colors.bg) pour la zone de sécurité maskable
mkdir -p public/icons

# Icônes "any" (l'OS ajoute un fond si besoin)
sips -Z 512 "$SRC" --out public/icons/icon-512.png >/dev/null
sips -Z 192 "$SRC" --out public/icons/icon-192.png >/dev/null
sips -Z 180 "$SRC" --out public/icons/apple-touch-icon.png >/dev/null

# Icônes "maskable" : réduire à ~80% puis padder au fond de marque (safe zone)
sips -Z 410 "$SRC" --out /tmp/_mask512.png >/dev/null
sips -p 512 512 --padColor "$BG" /tmp/_mask512.png --out public/icons/maskable-512.png >/dev/null
sips -Z 154 "$SRC" --out /tmp/_mask192.png >/dev/null
sips -p 192 192 --padColor "$BG" /tmp/_mask192.png --out public/icons/maskable-192.png >/dev/null
rm -f /tmp/_mask512.png /tmp/_mask192.png

echo "Icônes PWA générées dans public/icons/"
