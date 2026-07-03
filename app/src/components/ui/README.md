# Design System Scrutoir

But : **centraliser les décisions visuelles** pour que les refontes graphiques se fassent à un seul endroit. Une couleur, une police, un rayon, un padding de carte, un style de bouton → un seul fichier à changer, toute l'app suit.

## Où vivent les choses

| Quoi | Où |
|---|---|
| **Tokens** (couleurs, typo, espacement, rayons, ombres, tailles, mouvement) | `src/theme.ts` |
| **Bascule clair/sombre** | `src/themeMode.tsx` (`ThemeProvider`, `useThemeMode`) |
| **Couleurs de catégories** | `src/categoryUI.ts` |
| **Primitives** (composants réutilisables) | `src/components/ui/` |

Import unique des primitives : `import { Card, Chip, Button } from "../components/ui";` (ou `"./ui"` depuis `components/`).

## Tokens (`theme.ts`)

- **`C`** — palette VIVANTE (réécrite par `applyScheme` selon le thème). La couleur encode la **donnée de vote** (`pour`/`contre`/`abstention`), jamais un parti. `onAccent` = texte/icône posé sur un aplat `accent` (blanc en clair, encre foncée en sombre → contraste AA).
- **`F` / `T`** — familles Manrope + 5 crans typo (`micro 11 · small 13 · body 15 · heading 18 · title 22`). `callout` = `body` en semi-bold. Toujours prendre la TAILLE dans un cran de `T`.
- **`S`** — échelle d'espacement (grille 2px). Suffixe = px : `S.s12`, `S.s8`… Pour resserrer/aérer toute l'app, changer les valeurs ICI.
- **`RADIUS`** — `sm 10 · md 14 · lg 18 · xl 22 · pill 999`.
- **`ICON`** — tailles de pictos (`base 18` par défaut). **`CONTROL`** — hauteurs de contrôles. **`HIT_SLOP_MIN`** — 44 (cible tactile a11y).
- **`MOTION`** — durées d'animation (`fast 150 · base 250 · slow 450 · hero 850`).
- **`shadowCard`** — ombre VIVANTE (clair/sombre).

**Règle** : ne jamais coder en dur une valeur pour laquelle un token existe (hex de la palette, taille typo, rayon). Les valeurs d'espacement en dur sont tolérées (long tail non tokenisé), mais préférer `S.*` pour le rythme structurel.

## Primitives (`components/ui/`)

### `<Card>` — surface (la brique la plus répandue)
Fond `surface` + rayon `md` + padding 14 + ombre, par défaut. Props utiles : `onPress` (→ TouchableOpacity), `padding`, `radius`, `bordered` (filet `C.border`), `raised={false}` (sans ombre), `style` (tout le reste : `overflow`, `marginTop`, layout row…).
```tsx
<Card onPress={open} bordered style={{ marginTop: S.s14 }}>…</Card>
```
Changer le look de TOUTES les cartes → éditer `Card.tsx`.

### `<Chip>` — badge/pastille (libellé court coloré)
Couleurs `bg`/`fg` explicites (la couleur porte du sens). `radius` (défaut pill), `ph`/`pv`, `icon`, `textStyle`.
```tsx
<Chip label={adopte ? "Adopté" : "Rejeté"} bg={adopte ? C.adopteBg : C.rejeteBg} fg={adopte ? C.adopteFg : C.rejeteFg} radius={7} ph={9} pv={3} />
```

### `<Button>` — CTA (UNIFIÉ)
Rayon pill, 4 variantes × 3 tailles, définis une seule fois. Le libellé ET les icônes prennent automatiquement la couleur de premier plan (`onAccent` en `primary`).
- `variant` : `primary` (aplat accent) · `outline` (filet) · `soft` (accentSoft) · `text` (nu, `muted` pour atténuer).
- `size` : `sm` · `md` (défaut) · `lg`. `fullWidth`, `iconLeft`/`iconRight`, `loading`, `disabled`.
```tsx
<Button label="Commencer" onPress={start} fullWidth />
<Button label="Partager" onPress={share} variant="outline" size="sm" iconLeft={<Feather name="share-2" />} />
```
Changer le style de TOUS les boutons (rayon, padding, ombre) → éditer `Button.tsx`.

## Recettes de refonte rapide (le but du système)

- **Changer le vert « pour »** → `C.pour` (LIGHT + DARK) dans `theme.ts`.
- **Changer la police** → `F.*` dans `theme.ts`.
- **Arrondir/durcir les cartes** → `radius` par défaut dans `Card.tsx` (ou `RADIUS.md`).
- **Boutons carrés au lieu de pill** → `borderRadius: RADIUS.pill` → `RADIUS.md` dans `Button.tsx` (1 ligne).
- **Resserrer les espacements** → valeurs de `S` dans `theme.ts`.

## Cas volontairement bespoke (NON migrés)

Laissés tels quels (comportement à états ou viz sensible), à ne pas « corriger » sans réflexion :
- **Boutons à états** : contrôles segmentés (thème, période, avatars), bouton « suivre » (fond conditionnel), en-têtes d'accordéon.
- **Faux-boutons** : chips de suggestion qui naviguent, liens inline « Voir tout › ».
- **Viz** : barres divergentes, jauges de participation, hémicycles, curseurs, badges de proximité, cartes « Duels » (fonds sombres dédiés).

## Limites d'API connues (évolutions possibles)

- `Button` ne transmet pas `ref` → `TourNavigation` gère son focus a11y en bespoke.
- `Chip` n'a pas de `onPress` → les chips cliquables (navigation) restent bespoke.
- Pas encore de primitive `Segmented`/`ToggleButton` pour absorber les boutons à états.
