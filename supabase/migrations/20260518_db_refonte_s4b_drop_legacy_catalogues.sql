-- ============================================================
-- v0.16.x — Refonte BDD Sprint 4b — DROP legacy catalogues (PR-Cat-Drop)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Finalisation Sprint 4 (taxonomies fusion). Les 6 anciennes tables masters
-- sont remplacées par `taxonomies` depuis PR-DB-07 (création + seed) +
-- PR-DB-08 (switch reads).
--
-- Vérifications préalables passées :
-- - Aucun code app n'écrit sur ces 6 tables (grep src/ → 0 résultat)
-- - Aucun composant admin n'édite ces 6 tables (grep src/features/admin → 0)
-- - Counts identiques old vs new : 14+5+8+4+5+33 = 69 = taxonomies (0 drift)
-- - `taxonomies` contient tous les keys (RLS publique testée OK)
--
-- 4 FK pointent vers 4 de ces tables (allergen_types et diet_types n'ont
-- pas de FK entrante). On les drop d'abord, puis on drop les 6 tables.
--
-- Les colonnes `base_recipes.country/difficulty/type` et
-- `ingredients.subcategory` deviennent du text sans validation référentielle.
-- C'est OK : les valeurs valides sont dans `taxonomies` (lookup via le code).
-- Une future PR (Sprint 4c) pourra ajouter une validation CHECK ou trigger
-- si nécessaire — pour l'instant, validation app-side suffit.
-- ============================================================

BEGIN;

-- ─── 1) Drop FK contraintes vers les anciennes tables ──────────────────────
ALTER TABLE public.base_recipes DROP CONSTRAINT IF EXISTS fk_base_recipes_country;
ALTER TABLE public.base_recipes DROP CONSTRAINT IF EXISTS fk_base_recipes_difficulty;
ALTER TABLE public.base_recipes DROP CONSTRAINT IF EXISTS fk_base_recipes_type;
ALTER TABLE public.ingredients DROP CONSTRAINT IF EXISTS fk_ingredients_subcategory;

-- ─── 2) DROP les 6 tables anciennes ────────────────────────────────────────
-- CASCADE pour drop les éventuels indexes, policies, triggers résiduels
DROP TABLE IF EXISTS public.allergen_types CASCADE;
DROP TABLE IF EXISTS public.diet_types CASCADE;
DROP TABLE IF EXISTS public.countries_master CASCADE;
DROP TABLE IF EXISTS public.difficulty_types CASCADE;
DROP TABLE IF EXISTS public.meal_types CASCADE;
DROP TABLE IF EXISTS public.ingredient_subcategories CASCADE;

COMMIT;
