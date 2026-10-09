-- ============================================================
-- v3.129.1 — Data Quality v2 : vues health-check améliorées
-- ------------------------------------------------------------
-- 1. ingredient_health_check : détecte aussi les valeurs NULL
--    (les colonnes pack_size, price, nutrition peuvent être
--    NULL ou '{}' selon la version de migration ; on couvre
--    les deux cas).
-- 2. recipe_health_check : missing_steps détecte maintenant
--    aussi steps IS NULL et les tableaux vides dans toutes les
--    langues (ex: {"fr":[],"en":[]}) — cas rares mais possibles.
-- ============================================================

-- ─── 1. ingredient_health_check — v2 ─────────────────────────
-- Couvre : labels vides, nutrition/pack_size/price absents ou {},
-- default_unit NULL.

CREATE OR REPLACE VIEW public.ingredient_health_check AS
SELECT
  i.id,
  i.labels->>'fr' AS label_fr,
  i.subcategory,
  i.storage,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN COALESCE(i.labels->>'fr','')='' THEN 'missing_label_fr' END,
    CASE WHEN COALESCE(i.labels->>'en','')='' THEN 'missing_label_en' END,
    CASE WHEN COALESCE(i.labels->>'es','')='' THEN 'missing_label_es' END,
    CASE WHEN COALESCE(i.labels->>'de','')='' THEN 'missing_label_de' END,
    CASE WHEN COALESCE(i.labels->>'ja','')='' THEN 'missing_label_ja' END,
    CASE WHEN i.nutrition IS NULL OR i.nutrition = '{}'::jsonb
         THEN 'missing_nutrition' END,
    CASE WHEN i.pack_size IS NULL OR i.pack_size = '{}'::jsonb
         THEN 'missing_pack_size' END,
    CASE WHEN i.default_unit IS NULL
         THEN 'missing_default_unit' END,
    CASE WHEN i.price IS NULL OR i.price = '{}'::jsonb
         THEN 'missing_price' END
  ], NULL) AS issues,
  i.updated_at
FROM public.ingredients i;

ALTER VIEW public.ingredient_health_check SET (security_invoker = on);

COMMENT ON VIEW public.ingredient_health_check IS
  'v2 (v3.129.1) — Ingrédients avec issues. Détecte NULL et {} pour pack_size/price/nutrition.';

-- ─── 2. recipe_health_check — v2 ─────────────────────────────
-- missing_steps : couvre NULL, {}, [] et les cas où toutes les
-- langues ont un tableau vide ({"fr":[],"en":[],...}).

CREATE OR REPLACE VIEW public.recipe_health_check AS
SELECT
  r.id,
  r.name->>'fr' AS name_fr,
  r.status,
  r.country,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN jsonb_array_length(r.ingredients) = 0
         THEN 'no_ingredients' END,
    CASE WHEN r.servings <= 0 OR r.servings > 20
         THEN 'invalid_servings' END,
    CASE WHEN r.time_min <= 0 OR r.time_min > 480
         THEN 'invalid_time' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'fr','')=''
         THEN 'missing_desc_fr' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'en','')=''
         THEN 'missing_desc_en' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'es','')=''
         THEN 'missing_desc_es' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'de','')=''
         THEN 'missing_desc_de' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'ja','')=''
         THEN 'missing_desc_ja' END,
    CASE WHEN r.status='published' AND (
           r.steps IS NULL
        OR r.steps = '{}'::jsonb
        OR r.steps = '[]'::jsonb
        OR (
             -- Toutes les valeurs de steps sont des tableaux vides
             jsonb_typeof(r.steps) = 'object'
             AND NOT EXISTS (
               SELECT 1
               FROM jsonb_each(r.steps) kv
               WHERE jsonb_array_length(kv.value) > 0
             )
           )
         )
         THEN 'missing_steps' END,
    CASE WHEN r.status='published' AND COALESCE(r.country,'')=''
         THEN 'missing_country' END,
    CASE WHEN COALESCE(jsonb_array_length(r.diet),0) = 0
         AND COALESCE(cardinality(r.allergens),0) = 0
         THEN 'missing_diet' END
  ], NULL) AS issues,
  r.updated_at
FROM public.base_recipes r;

ALTER VIEW public.recipe_health_check SET (security_invoker = on);

COMMENT ON VIEW public.recipe_health_check IS
  'v2 (v3.129.1) — Recettes avec issues. missing_steps couvre NULL/{}/[]/tableaux vides multi-lang.';
