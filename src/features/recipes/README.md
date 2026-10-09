# Feature `recipes`

> Catalogue de recettes, matching avec le frigo (score), création/édition, publication communautaire,
> avis. C'est le cœur de valeur du produit. (Structure vérifiée contre `dev` le 2026-06-22.)

## Rôle
Donner, à partir du `stock` du frigo, les recettes faisables et les classer par pertinence ;
permettre de créer/publier ses propres recettes et de gérer favoris/avis.

## Structure
- **`api/`** — accès Supabase : `recipes.js` (lecture recettes/by-id/custom), `favorites.js`,
  `recipe-reviews.js`.
- **`hooks/`** — `use-recipe-by-id`, `use-recipe-filters`, `use-similar-recipes`, `use-favorites`.
- **`lib/`** — logique métier (sans UI) :
  - `recipe-scoring.js` — **le calcul de match recette ↔ stock** (cœur du classement).
  - `pantry-staples.js` — garde-manger assumé (sel/huile/épices toujours « présents ») ; influe sur le score.
  - `cook-first-sort.js` — tri « à cuisiner en priorité » (lié à l'anti-gaspi/péremption).
  - `custom-recipes.js` — lecture des recettes custom (⚠️ via la VUE `custom_recipes`, cf. ADR 0003).
  - `health-score.js`, `recipe-draft.js` (brouillon création), `recipe-ai-moderation.js`,
    `recipe-publish-consent.js`, `recipe-filters-url.js`, `recipe-print.js`, `recipe-to-schema-org.js`.
- **`components/`** — UI : `recipe-card`, `recipe-modal`, `recipe-panel`, formulaire de création
  (`recipe-form-*`), filtres (`filters/*`), avis, partage, allergènes.
- **`pages/recipe-page.jsx`** — page dédiée d'une recette.
- **`index.js`** — exports publics de la feature.

## Décisions non-évidentes (→ `docs/adr/`)
- **Données recettes : statique ↔ Supabase** — `src/shared/static/recipes.js` (statique) coexiste avec
  `api/recipes.js` (Supabase). Vérifier où une donnée est réellement lue. → [ADR 0004](../../../docs/adr/0004-donnees-static-vs-supabase.md).
- **`custom_recipes` est une VUE**, pas une table (écriture = dans les tables sous-jacentes). →
  [ADR 0003](../../../docs/adr/0003-custom-recipes-vue.md).
- **i18n inline** — les libellés de recette suivent le pattern `I18N` par composant. → [ADR 0002](../../../docs/adr/0002-i18n-inline-par-composant.md).

## Dépendances
- `src/shared/static/recipes.js` (données statiques), `src/shared/lib/supabase/*` (client),
  le `stock` (sets gérés dans `App.jsx`) pour le scoring.
- Vue d'ensemble : `docs/ARCHITECTURE.md`.
