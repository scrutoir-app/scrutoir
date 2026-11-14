# Assets de marque Scrutoir

Logo « hémicycle » (vectoriel) — à uploader tel quel (Canva, etc.) plutôt que de le faire redessiner.

- `scrutoir-mark.svg` — fond clair (points #171A1F, centre #3C4654)
- `scrutoir-mark-white.svg` — fond foncé (tout blanc)
- `scrutoir-mark.png` — PNG 1024px (fond clair), dépannage

## Sur fond sombre : contour citron (depuis le 14/11/2026)

Sur fond sombre, le siège blanc (rang extérieur, flanc droit, index 2) et le point du i prennent un
contour citron `#C8FF2E` ; leur intérieur est évidé (on voit le fond). Le gros rond central et les
autres sièges sont blancs. Sur fond clair, rien ne change : contour encre `#171A1F`, logo déposé à
l'INPI (marque figurative n°5272135).

Fond transparent, à poser sur un fond sombre (#161A20 pour les visuels Instagram) :

- `scrutoir-mark-sombre-citron` — picto seul
- `scrutoir-wordmark-sombre-citron` — mot seul
- `scrutoir-logo-horizontal-sombre-citron` — picto à gauche du mot
- `scrutoir-logo-vertical-sombre-citron` — picto au-dessus du mot

Chacun en `.svg` et en `.png` (@1x, `@2x`, `@3x`). Régénération, avec les icônes d'app et le
favicon : `node app/scripts/gen-marque-sombre.mjs` (ne touche jamais aux fichiers clairs).

## Source

Source du picto/logotype en vigueur dans l'app (depuis 1.0.46) :
`app/src/components/brand/` — `ScrutoirMark.tsx` (picto, siège blanc contour encre),
`ScrutoirWordmark.tsx` (logotype vectorisé Manrope ExtraBold) et `ScrutoirLogo.tsx` (lockup).
Géométrie commune : `geometrie.ts`. Couleur du contour : token `marqueContour` de `theme.ts`
(encre en clair, citron en sombre).
L'ancien picto monochrome subsiste à `app/src/components/ScrutoirMark.tsx` (filigranes).
Les SVG/PNG ci-dessus sont les exports statiques pour upload externe. Régénération des exports
clairs : voir l'historique git.
