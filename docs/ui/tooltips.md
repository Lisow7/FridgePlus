# Tooltips — règle d'usage (#2)

Objectif : rendre les features compréhensibles **sans** encombrer. Un tooltip
n'est justifié **que** s'il lève une ambiguïté réelle et **ne duplique jamais**
un texte déjà visible.

## Les 2 composants (même moteur de positionnement)

Tous s'appuient sur `src/shared/ui/anchored-popover.jsx` (portail `position:fixed`,
clamp viewport, flip haut/bas, a11y) → **jamais rognés**, marchent au **tap mobile**.

| Besoin | Composant | Déclenchement |
|---|---|---|
| Nommer/expliquer un contrôle **icône-seule** ou un badge | `Tooltip` (`shared/ui/tooltip.jsx`) | survol · focus · tap — **sans marqueur**, n'intercepte pas le clic |
| Aide **optionnelle plus longue** sur une notion | `InfoTooltip` (`shared/ui/info-tooltip.jsx`) | pastille « i » visible, clic/survol |
| Terme culinaire dans une étape | `GlossaryText` | mot souligné pointillé, clic |

## Quand OUI

- **Bouton icône-seule sans label** (header, actions recette/carte) → `Tooltip` court (2-5 mots) décrivant l'action. Remplace les `title=` natifs (invisibles au tap, non stylés).
- **Badge / indicateur** dont le sens n'est pas évident → `Tooltip`.
- **Notion à expliquer** (score nutrition, allergènes & traces, un réglage) → **un** `InfoTooltip` par zone.

## Quand NON (anti-clutter)

- ❌ Sur un élément qui a **déjà un label texte visible** (le bouton dit « Ajouter au panier » → pas de tooltip).
- ❌ **Deux « i » côte à côte**, ou un « i » sur une action évidente.
- ❌ Tooltip **décoratif** / qui répète l'évident.
- ❌ **Cacher une info critique** derrière un tooltip : sécurité, allergènes, avertissements restent **visibles**. Le tooltip ne fait qu'**expliquer**, jamais porter l'info seule.

## Contenu

- `Tooltip` : impératif court, même voix que l'UI, traduit (`t.*` selon `lang`).
- `InfoTooltip` : 1-3 phrases, traduit.
- Toujours fournir un `aria-label` sur le contrôle sous-jacent (le tooltip complète, ne remplace pas l'a11y).
