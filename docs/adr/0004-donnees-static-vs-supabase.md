# 0004 — Données : fichiers statiques (`src/shared/static`) ↔ Supabase

- Statut : accepté (migration en cours)
- Date : 2026-06-22

## Contexte et problème
Les données de référence (ingrédients, recettes, layouts de frigo) ont d'abord vécu en JS statique.
L'objectif de fond est d'en faire **Supabase la source unique**. La transition n'est pas terminée.

## Décision (état réel au 2026-06-22, vérifié contre le code)
- **Encore servi par des fichiers statiques** `src/shared/static/` :
  - `ingredients.js`, `recipes.js`, `fridge-layouts.js` — lus directement par de nombreux
    composants (`fridge/*`, `cart/*`, `admin/*`).
  - `changelog.js` vit dans `src/features/changelog/data/`.
- **Déjà servi par Supabase** : les recettes communautaires/custom et la lecture par id via
  `src/features/recipes/api/recipes.js` (utilisé par `use-recipe-by-id`, `use-similar-recipes`,
  `custom-recipes.js`).
- `npm run migrate` (`scripts/sync-ingredients.mjs`) pousse **uniquement la table `ingredients`**
  vers Supabase (UPSERT idempotent). L'ancien `migrate:legacy` (`scripts/migrate-to-db.mjs`) est
  **obsolète** (référence des fichiers data supprimés).

## Conséquences
- (−) **Double source pendant la transition** : un nouveau dev ne doit PAS supposer que
  `src/shared/static/*` est la vérité pour tout, ni que Supabase l'est pour tout. **Vérifier au cas
  par cas** où une donnée est réellement lue avant de la modifier.
- (+) À terme : une seule source (Supabase).
- Liés : `supabase/SCHEMA.md` (gitignored), `npm run migrate`, `npm run db:types`.
