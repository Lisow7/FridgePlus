# Feature `fridge`

> Le frigo lui-même : visualisation par compartiments, gestion du `stock` (ajout/retrait
> d'ingrédients), restes et anti-gaspi. Point d'entrée du parcours produit.
> (Structure vérifiée contre `dev` le 2026-06-22.)

## Rôle
Afficher le frigo (compartiments, garde-manger), laisser l'utilisateur poser/retirer des
ingrédients (`stock`), et alimenter le reste de l'app (recettes, score anti-gaspi).

## Structure
- **`api/`** — accès Supabase : `stock.js` (état du frigo connecté), `stock-events.js`
  (journal des ajouts/retraits), `leftovers.js` (restes).
- **`hooks/`** — `use-fridge-stock` (source du `stock`, persistance dual-mode), `use-leftovers`.
- **`lib/`** — `categorize-ingredients.js` (range un ingrédient dans le bon compartiment),
  `waste-prevention.js` (logique anti-gaspi), `record-removed.js` (capture des retraits),
  `fab-primary-action.js` (action principale du bouton flottant).
- **`components/`** — `fridge.jsx` (conteneur) + **3 variantes de layout** :
  `fridge-standard`, `fridge-multi-door`, `fridge-side-by-side` ; plus `pantry-shelf`,
  `fridge-toolbar`, `fridge-fab`, `fridge-tagline`, `leftover-card`, `leftovers-modal`.
- **`index.js`** — exports publics de la feature.

## Décisions non-évidentes (→ `docs/adr/` et `docs/ARCHITECTURE.md`)
- **Layout dépendant de la langue** : la variante affichée (standard / multi-door / side-by-side)
  et les compartiments viennent de `FRIDGE_LAYOUTS[lang]` dans `src/shared/static/fridge-layouts.js`
  (fr → top-freezer, en → side-by-side…). Ne pas coder en dur une disposition. Voir
  [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) §5.
- **`stock` en persistance dual-mode** : `localStorage` (invité) ↔ Supabase (connecté), migration au
  login. `use-fridge-stock` consomme cette logique. → [ADR 0001](../../../docs/adr/0001-persistance-dual-mode.md).
- **i18n inline** : libellés via `I18N` par composant. → [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).

## Dépendances
- `src/shared/static/fridge-layouts.js` (structure + libellés), `src/shared/static/ingredients.js`,
  le `stock` (sets gérés dans `App.jsx`), `src/shared/lib/supabase/*`.
- Le `stock` alimente le scoring des recettes (feature `recipes`) et le score anti-gaspi (profil).
