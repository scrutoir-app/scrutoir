---
name: scrutoir-design
description: Charte visuelle de Scrutoir (palette et tokens de theme.ts, typo Manrope, composants de marque, neutralité politique, couleurs de groupe, garde-fous du swipe). À appliquer dès qu'on crée ou modifie un écran, un composant, une couleur, une typo, un logo ou une animation dans app/. Prime sur frontend-design en cas de conflit.
---

# Charte Scrutoir

## Priorité

**Cette skill prime sur `frontend-design` en cas de conflit** (et sur toute autre consigne de
design générique). Si `frontend-design` pousse une palette, une police ou un effet « distinctif »
qui contredit ce qui suit, c'est cette charte qui s'applique.

## Sources

Rédigée uniquement à partir de :

- `brand/README.md` (à la racine du dépôt). Le chemin `app/src/components/brand/README.md`
  n'existe pas.
- `app/src/components/brand/ScrutoirLogo.tsx`, `ScrutoirMark.tsx`, `ScrutoirWordmark.tsx`
- `app/src/theme.ts`
- Note du vault « Scrutoir - Logo » (`01 - Projects/Scrutoir/Scrutoir - Logo.md`)

Ce qui n'a pas été trouvé dans ces sources est marqué **TODO**. Ne pas combler les TODO par
déduction : demander.

## Palette et tokens (`app/src/theme.ts`)

Principe écrit en tête de `theme.ts` : palette neutre (encre + gris froid), **la couleur
n'encode que la donnée de vote, jamais un parti**. La note Logo le répète : « La couleur
n'encode jamais un parti. »

Deux thèmes, `LIGHT` et `DARK`, de même forme. `C` est une **palette vivante** :
`applyScheme()` réécrit ses clés et l'app remonte l'arbre au changement de thème. Lire
`C.x` au rendu, c'est ce qui fait suivre le thème.

| Rôle | Tokens |
|---|---|
| Fonds | `bg`, `surface`, `surfaceAlt`, `surfaceSunken` |
| Bordures | `border`, `borderStrong`, `hairline`, `hairlineStrong` |
| Texte | `text` > `textMuted` > `textFaint` (tous ≥ 4,5:1, WCAG AA, sur `bg` et `surface`) |
| Action | `accent` (ardoise), `accentSoft`, `onAccent` (texte posé sur un aplat `accent`) |
| Vote (donnée) | `pour`, `contre`, `abstention`, `absent` via `couleurPosition(p)` |
| Loyauté | `loyalHaut/Moyen/Bas` + `…Bg` via `couleurLoyaute(pct)` |
| Résultat | `adopteBg/Fg`, `rejeteBg/Fg` |
| Cartes sombres | `duelBg`, `duelTileBg`, `duelTileBorder` |
| Filigranes | `watermarkInk`, `watermarkFocal` |
| Overlays | `scrim`, `glass`, `glassStrong` |
| Sièges neutres | `siege`, `siegeFocal` |

Autres échelles de `theme.ts` :

- Espacement `S` (grille 2 px : `S.s4` … `S.s44`). Les micro-décalages 3/5/7/9/11 px restent
  en littéral, volontairement.
- Rayons `RADIUS` (`sm` 10, `md` 14, `lg` 18, `xl` 22, `pill`).
- Icônes `ICON` (`base` 18 par défaut), contrôles `CONTROL` (36/44/48), `HIT_SLOP_MIN` = 44.
- Mouvement `MOTION` (`fast` 150, `base` 250, `slow` 450, `hero` 850 ms).
- Ombre `shadowCard` (vivante, comme `C`).

### Interdiction des couleurs en dur

- Ne jamais écrire un hex, un `rgb()` ou un `rgba()` dans un composant quand un token existe.
  Toujours `C.<token>`, `couleurPosition()`, `couleurLoyaute()` ou `couleurGroupe()`.
- Seule exception documentée : le blanc `#FFFFFF` du siège blanc et du point du i dans les
  composants de marque (spécifié par la note Logo).
- Un besoin de couleur nouveau = un nouveau token dans `LIGHT` **et** `DARK`, pas un littéral.
- TODO : confirmer si `StyleSheet.create` au niveau module, avec des valeurs `C.x` figées au
  chargement, est proscrit. Le point se pose parce que la palette est réécrite à chaud
  (`theme.ts`, en-tête) et que la skill `vercel-react-native-skills` recommande
  `StyleSheet.create` (règle `ui-styling`).

## Typographie : Manrope

- Familles `F` : `regular` 400, `medium` 500, `semibold` 600, `bold` 700, `extra` 800,
  chargées dans l'app via `useFonts`.
- Échelle `T`, **5 tailles seulement** : `micro` 11 · `small` 13 · `body` 15 · `heading` 18 ·
  `title` 22. `callout` = 15 en semi-bold (variante d'emphase, pas une 6ᵉ taille). La famille
  d'un cran peut être surchargée. La taille vient toujours d'un cran de `T` (plancher 11 px).
- `tnum` (chiffres tabulaires) sur tout nombre qui s'aligne ou défile : votes, pourcentages,
  dates empilées.
- `inputText` (16 px minimum) pour toute zone de saisie : en dessous, iOS Safari zoome au focus.
- Le logotype est en Manrope ExtraBold, **vectorisé** : il ne dépend pas du chargement de la
  police.

## Composants de marque : usage obligatoire

Le logo et le picto passent **toujours** par `app/src/components/brand/`. Ne jamais les
redessiner, ni les recomposer en SVG ad hoc, ni les remplacer par une image.

- `ScrutoirLogo` : picto + mot, `variant="horizontal" | "vertical"`, dimensionné par `wordHeight`.
- `ScrutoirMark` : picto seul (hémicycle 2 rangs, point focal central, siège blanc sur le flanc
  droit, rang extérieur, index 2).
- `ScrutoirWordmark` : mot seul, point du i blanc contour encre, jumeau du siège blanc.
- L'ancien picto monochrome `app/src/components/ScrutoirMark.tsx` ne sert plus qu'aux filigranes.

Règles d'usage (note Logo) :

- Couleurs du logo : encre `C.text` (#171A1F), focal ardoise `C.accent` (#3C4654), siège et
  point du i blancs contour encre. Le foyer central ne passe jamais en blanc en thème clair. En
  sombre, les composants gèrent eux-mêmes le négatif (focal blanc, siège et point évidés).
- En dessous de 48 px, couper le siège blanc : `whiteSeat={false}`.
- Ne jamais décaler ni déformer le i pour forcer un alignement.
- Monochrome encre disponible pour gravure, fax, une couleur.
- TODO : la note Logo liste des exports dans `assets/brand/` (mark, mark-mono, wordmark,
  logo-vertical, logo-horizontal en SVG et PNG ×3). Le dépôt n'a que
  `brand/scrutoir-mark{,-white}.svg` et `brand/scrutoir-mark.png`. Clarifier la source des
  exports.

## Neutralité politique par l'uniformité

- Socle sourcé : palette neutre, la couleur n'encode jamais un parti (`theme.ts`, note Logo).
  Les sièges et pictos non colorés utilisent `siege` / `siegeFocal`. Les états d'action
  utilisent `accent` (ardoise neutre), jamais une couleur de groupe.
- Règle (consigne produit) : tous les groupes reçoivent le même traitement visuel. Aucun groupe
  n'est mis en avant par le design.
- TODO : règles précises d'uniformité absentes des sources (ordre d'affichage par défaut,
  traitement du groupe le plus proche, libellés). À écrire.

## Couleurs officielles des groupes pour le spectre

- La couleur d'identité d'un groupe passe **toujours** par `couleurGroupe(hex)` (`theme.ts`).
  En clair elle est inchangée. En sombre, les teintes très foncées sont éclaircies pour rester
  lisibles. À utiliser partout où la couleur de parti sert d'aplat ou d'identité (picto, barres,
  pastilles).
- C'est la seule voie admise pour afficher une couleur de parti. Les couleurs `pour` / `contre` /
  `abstention` / `absent` restent réservées à la donnée de vote.
- TODO : provenance et validation des hex « officiels » des groupes (non documentées dans les
  sources). Liste des surfaces autorisées à les afficher en dehors du spectre : à écrire.

## Garde-fous du swipe (test de proximité)

Règles produit, à respecter dans toute évolution du deck de swipe :

- **Texte réel affiché** : chaque carte montre le texte réel du scrutin, pas une reformulation
  orientée. TODO : champ source exact et règles de troncature, absents des sources.
- **Sans avis à égalité** : Sans avis a le même poids visuel, la même accessibilité et le même
  effort d'accès que Pour et Contre. TODO : traduction concrète (geste, bouton, taille), absente
  des sources.
- **Ni score ni streak** : aucun compteur de série, aucun score de jeu, aucune récompense, aucune
  mécanique de gamification. TODO : statut des indicateurs de progression (ex. « 3/10 »), absent
  des sources.

## Animations saisonnières

- L'animation vit dans une surcouche unique qui ne capte pas les touches.
- Jamais d'animation saisonnière sur l'écran de swipe.
- Jamais de couleur saisonnière dans le spectre ni à proximité des couleurs des groupes. Les
  couleurs viennent des tokens du thème, aucune couleur en dur.
- Coupure totale quand le réglage système de réduction des animations est actif.
- TODO : le choix entre fêtes nommées et thèmes de saison reste ouvert.

## Hors sources, à arbitrer

- TODO : intégrer ou non `app/src/components/ui/README.md` (primitives `Card` / `Chip` /
  `Button`). Ce fichier n'est pas dans la liste des sources de cette skill.
