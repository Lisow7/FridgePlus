-- ============================================================
-- v3.3.12 — Extend `ingredients` (5 colonnes) + FK + index + CHECK
-- ------------------------------------------------------------
-- Décision A (cf. project_db_architecture_decisions.md) : tout-en-un sur
-- `ingredients` (jsonb pour structures complexes, text[] pour les arrays
-- de keys vers les référentiels). Pas de table séparée.
--
-- Pré-requis :
--   • Migration 20260503_create_master_subcategories.sql appliquée (FK)
--
-- Colonnes ajoutées :
--   • nutrition jsonb       — {calories, protein, carbs, fat, fiber, salt} /100g
--   • pack_size jsonb       — {default:{value,unit}, alternatives:[…]}
--   • allergens text[]      — keys de allergen_types (pas de FK car array)
--   • breaks_diets text[]   — keys de diet_types (pas de FK car array)
--   • default_unit text     — g / ml / piece / tbsp / tsp / cup
-- ============================================================

ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS nutrition     jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pack_size     jsonb  NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allergens     text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS breaks_diets  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_unit  text;

-- ─── CHECK constraints (verrouillage des valeurs autorisées)

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS chk_ingredients_default_unit;
ALTER TABLE public.ingredients
  ADD CONSTRAINT chk_ingredients_default_unit
  CHECK (default_unit IS NULL OR default_unit IN ('g','ml','piece','tbsp','tsp','cup'));

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS chk_ingredients_storage;
ALTER TABLE public.ingredients
  ADD CONSTRAINT chk_ingredients_storage
  CHECK (storage IN ('frz','fr','vg','gp','sp','bk'));

-- ─── FK vers ingredient_subcategories (intégrité référentielle)
-- Note : NOT VALID puis VALIDATE permettrait un déploiement progressif sur
-- une grosse table. Ici, 622 rows et seed fallback déjà appliqué → safe.

ALTER TABLE public.ingredients
  DROP CONSTRAINT IF EXISTS fk_ingredients_subcategory;
ALTER TABLE public.ingredients
  ADD CONSTRAINT fk_ingredients_subcategory
  FOREIGN KEY (subcategory)
  REFERENCES public.ingredient_subcategories(key)
  ON DELETE RESTRICT;

-- ─── Index (perf : éviter seq scans dès que la table grossit)

CREATE INDEX IF NOT EXISTS idx_ingredients_subcategory
  ON public.ingredients (subcategory);

CREATE INDEX IF NOT EXISTS idx_ingredients_storage
  ON public.ingredients (storage);

CREATE INDEX IF NOT EXISTS idx_ingredients_allergens
  ON public.ingredients USING GIN (allergens);

CREATE INDEX IF NOT EXISTS idx_ingredients_breaks_diets
  ON public.ingredients USING GIN (breaks_diets);

-- ─── Commentaires

COMMENT ON COLUMN public.ingredients.nutrition IS
  'Valeurs nutritionnelles /100g — {calories, protein, carbs, fat, fiber, salt}. Source : nutrition.js (data migration PR 2).';
COMMENT ON COLUMN public.ingredients.pack_size IS
  'Tailles de pack standard — {default:{value,unit}, alternatives:[{value,unit},…]}. Pour le panier (V6).';
COMMENT ON COLUMN public.ingredients.allergens IS
  'Array de keys d''allergen_types (sans FK : pas supporté sur array Postgres). Validation app-side.';
COMMENT ON COLUMN public.ingredients.breaks_diets IS
  'Array de keys de diet_types qu''ingredient « casse » (ex: viande → [vegan, vegetarian]).';
COMMENT ON COLUMN public.ingredients.default_unit IS
  'Unité de mesure par défaut pour ce ingrédient. CHECK : g/ml/piece/tbsp/tsp/cup.';
