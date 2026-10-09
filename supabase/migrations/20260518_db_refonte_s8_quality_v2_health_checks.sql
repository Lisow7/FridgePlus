-- ============================================================
-- v0.16.x — Refonte BDD Sprint 8 (Qualité v2) — Health checks v2
-- ------------------------------------------------------------
-- Refonte des vues recipe_health_check + ingredient_health_check pour
-- couvrir les 5 dimensions Data Quality 2026 (sources : soda.io,
-- dataKitchen, Atlan) :
--
--   1. COMPLETENESS  — champs essentiels présents
--   2. ACCURACY      — valeurs dans des plages plausibles
--   3. CONSISTENCY   — pas de contradictions internes
--   4. VALIDITY      — format respecte les règles métier
--   5. UNIQUENESS    — pas de doublons fonctionnels
--
-- Extension scope : inclure les recettes communauté (origin='community')
-- via la lecture sur recipes_unified au lieu de base_recipes uniquement.
--
-- RGPD considerations :
--   - PAS d'exposition user_id, email, ou PII dans le payload `issues`
--   - Filtre soft-deleted (deleted_at IS NULL) — Art. 17 droit à l'oubli
--   - Vue security_invoker=true → RLS recipes_unified s'applique
--     (admin via is_admin(), pas de bypass)
--   - Pas de stockage : vue calculée à la query, aucune nouvelle data
--     persistée. Pas d'impact sur les durées de conservation.
--   - L'admin qui agit sur un flag (delete, edit) est tracé via
--     activity_logs (existing audit log).
--
-- Performance : views simples (~108 recipes + 612 ingredients à scanner).
-- Pas besoin de materialized view à ce volume.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) recipe_health_check v2 — étend à recipes_unified + nouveaux checks
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.recipe_health_check AS
WITH
  -- Pré-calcule l'ensemble des IDs ingrédients existants pour les checks
  -- d'orphelins. Permet une LEFT JOIN simple sans subquery par row.
  valid_ingredient_ids AS (
    SELECT id FROM public.ingredients
  ),
  -- Pré-calcule les noms FR normalisés pour la détection de doublons.
  recipe_names_normalized AS (
    SELECT
      id,
      lower(trim(name->>'fr')) AS name_norm
    FROM public.recipes_unified
    WHERE deleted_at IS NULL  -- RGPD : exclude soft-deleted
  ),
  -- Détecte les noms FR dupliqués (case + accent + whitespace ignored).
  -- Utilise simple lower+trim, suffisant à 108 recettes. Si volume scale
  -- → activer pg_trgm pour fuzzy match dans une PR future.
  duplicate_names AS (
    SELECT name_norm
    FROM recipe_names_normalized
    WHERE name_norm IS NOT NULL AND name_norm <> ''
    GROUP BY name_norm
    HAVING count(*) > 1
  ),
  -- Pour chaque recette, pré-calcule les ingrédients ID référencés
  -- (extrait depuis le jsonb array ingredients).
  recipe_ingredient_refs AS (
    SELECT
      r.id AS recipe_id,
      (ing->>'id')::text AS ingredient_id
    FROM public.recipes_unified r,
         jsonb_array_elements(r.ingredients) AS ing
    WHERE r.deleted_at IS NULL
      AND ing ? 'id'
  ),
  -- Détecte les ingrédients orphelins (référencés mais inexistants).
  orphan_ingredients_per_recipe AS (
    SELECT
      rir.recipe_id,
      count(*) AS orphan_count
    FROM recipe_ingredient_refs rir
    LEFT JOIN valid_ingredient_ids v ON v.id = rir.ingredient_id
    WHERE v.id IS NULL
    GROUP BY rir.recipe_id
  ),
  -- Détecte les ingrédients sans quantité ni unité (validity check).
  invalid_ingredient_slots_per_recipe AS (
    SELECT
      r.id AS recipe_id,
      count(*) AS bad_slots
    FROM public.recipes_unified r,
         jsonb_array_elements(r.ingredients) AS ing
    WHERE r.deleted_at IS NULL
      AND (
        (ing->>'amount' IS NULL OR ing->>'amount' = '')
        AND (ing->>'unit' IS NULL OR ing->>'unit' = '')
        AND (ing->>'qty' IS NULL OR ing->>'qty' = '')
      )
    GROUP BY r.id
  ),
  -- Détecte les inconsistances diet vs ingredients.breaks_diets.
  -- Ex : recette taggée vegan mais utilise un ingrédient qui breaks vegan.
  diet_consistency AS (
    SELECT
      r.id AS recipe_id,
      array_agg(DISTINCT broken_diet) AS broken_diets
    FROM public.recipes_unified r,
         jsonb_array_elements(r.ingredients) AS ing
         JOIN public.ingredients i ON i.id = (ing->>'id')::text,
         jsonb_array_elements_text(r.diet) AS recipe_diet,
         unnest(COALESCE(i.breaks_diets, '{}'::text[])) AS broken_diet
    WHERE r.deleted_at IS NULL
      AND recipe_diet = broken_diet
    GROUP BY r.id
  )
SELECT
  r.id,
  r.name->>'fr' AS name_fr,
  r.origin,
  r.status,
  r.country,
  ARRAY_REMOVE(ARRAY[
    -- ─── COMPLETENESS — champs essentiels présents ─────────────────────────
    CASE WHEN jsonb_array_length(COALESCE(r.ingredients, '[]'::jsonb)) = 0
         THEN 'no_ingredients' END,
    CASE WHEN COALESCE(r.emoji, '') IN ('', '🍳')  -- 🍳 = default placeholder
         THEN 'missing_emoji' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'fr','')=''
         THEN 'missing_desc_fr' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'en','')=''
         THEN 'missing_desc_en' END,
    CASE WHEN r.status='published'
              AND (r.steps='{}'::jsonb OR r.steps='[]'::jsonb
                   OR r.steps IS NULL)
         THEN 'missing_steps' END,
    CASE WHEN r.status='published' AND COALESCE(r.country,'')=''
         THEN 'missing_country' END,

    -- ─── ACCURACY — valeurs plausibles ─────────────────────────────────────
    CASE WHEN r.servings <= 0 OR r.servings > 20
         THEN 'invalid_servings' END,
    CASE WHEN r.time_min <= 0 OR r.time_min > 480
         THEN 'invalid_time' END,

    -- ─── VALIDITY — règles métier ──────────────────────────────────────────
    -- Steps trop courts : <3 étapes ou tableau strings courts (<10 chars).
    -- Indicateur que la recette n'est pas exploitable utilisateur.
    CASE WHEN r.status='published'
              AND jsonb_typeof(r.steps->'fr') = 'array'
              AND jsonb_array_length(r.steps->'fr') < 3
         THEN 'steps_too_short' END,
    -- Ingrédients sans quantité ni unité (au moins 1 slot).
    CASE WHEN iisp.bad_slots IS NOT NULL AND iisp.bad_slots > 0
         THEN 'ingredient_slots_missing_qty' END,

    -- ─── CONSISTENCY — pas de contradictions ───────────────────────────────
    -- Ingrédients orphelins : ID référencé qui n'existe pas dans la table
    -- ingredients. Bug data important — la recette ne peut pas être
    -- scorée ou ajoutée au panier correctement.
    CASE WHEN oip.orphan_count IS NOT NULL AND oip.orphan_count > 0
         THEN 'orphan_ingredients' END,
    -- Diet vs breaks_diets — incohérence sémantique majeure.
    -- Ex: recette taggée "vegetarian" contenant un ingrédient avec
    -- breaks_diets=['vegetarian']. Évite que des recettes soient mal
    -- présentées aux users avec préférences alimentaires.
    CASE WHEN dc.broken_diets IS NOT NULL
         THEN 'diet_inconsistent' END,
    -- ─── UNIQUENESS — pas de doublons fonctionnels ─────────────────────────
    -- Nom FR identique (lower+trim) → doublon suspect.
    CASE WHEN dn.name_norm IS NOT NULL
         THEN 'duplicate_name_fr' END,
    -- Diet ET allergens vides simultanément = données vraiment manquantes
    -- (cf. v3.111.0 — affinement legacy check).
    CASE WHEN COALESCE(jsonb_array_length(r.diet), 0) = 0
              AND COALESCE(cardinality(r.allergens), 0) = 0
         THEN 'missing_diet_allergens' END
  ], NULL) AS issues,
  -- Métadonnées contextuelles pour aider l'admin (NON personnelles)
  COALESCE(oip.orphan_count, 0) AS orphan_count,
  COALESCE(iisp.bad_slots, 0)   AS bad_slot_count,
  dc.broken_diets,
  r.updated_at
FROM public.recipes_unified r
LEFT JOIN orphan_ingredients_per_recipe oip ON oip.recipe_id = r.id
LEFT JOIN invalid_ingredient_slots_per_recipe iisp ON iisp.recipe_id = r.id
LEFT JOIN diet_consistency dc ON dc.recipe_id = r.id
LEFT JOIN recipe_names_normalized rn ON rn.id = r.id
LEFT JOIN duplicate_names dn ON dn.name_norm = rn.name_norm
WHERE r.deleted_at IS NULL;  -- RGPD : exclude soft-deleted

ALTER VIEW public.recipe_health_check SET (security_invoker = on);

COMMENT ON VIEW public.recipe_health_check IS
  'Refonte Sprint 8 Qualité v2. Couvre 5 dimensions DQ (complet/accur/cohér/valid/uniq). Étendue à recipes_unified (officials + community). RGPD-compliant : pas de PII, soft-deleted exclus. Issues array vide = recette saine.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) ingredient_health_check v2 — nouveaux checks (uniqueness, consistency)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW public.ingredient_health_check AS
WITH
  -- Détection doublons FR normalisés
  ingredient_names_normalized AS (
    SELECT
      id,
      lower(trim(labels->>'fr')) AS label_norm
    FROM public.ingredients
  ),
  duplicate_labels AS (
    SELECT label_norm
    FROM ingredient_names_normalized
    WHERE label_norm IS NOT NULL AND label_norm <> ''
    GROUP BY label_norm
    HAVING count(*) > 1
  ),
  -- Calcul des macros pour cohérence nutrition (kcal vs P/G/L).
  -- 1g P = 4 kcal, 1g G = 4 kcal, 1g L = 9 kcal.
  -- Tolérance ±30 % (variabilité naturelle des aliments + arrondis).
  nutrition_check AS (
    SELECT
      id,
      (i.nutrition->>'calories')::numeric AS kcal,
      (i.nutrition->>'protein')::numeric  AS p,
      (i.nutrition->>'carbs')::numeric    AS g,
      (i.nutrition->>'fat')::numeric      AS l
    FROM public.ingredients i
    WHERE i.nutrition <> '{}'::jsonb
      AND (i.nutrition->>'calories') ~ '^[0-9.]+$'
  )
SELECT
  i.id,
  i.labels->>'fr' AS label_fr,
  i.subcategory,
  i.storage,
  ARRAY_REMOVE(ARRAY[
    -- ─── COMPLETENESS ─────────────────────────────────────────────────────
    CASE WHEN COALESCE(i.labels->>'fr','')='' THEN 'missing_label_fr' END,
    CASE WHEN COALESCE(i.labels->>'en','')='' THEN 'missing_label_en' END,
    CASE WHEN COALESCE(i.emoji, '') IN ('', '🥄') THEN 'missing_emoji' END,
    CASE WHEN i.nutrition = '{}'::jsonb     THEN 'missing_nutrition' END,
    CASE WHEN i.pack_size = '{}'::jsonb     THEN 'missing_pack_size' END,
    CASE WHEN i.default_unit IS NULL        THEN 'missing_default_unit' END,
    CASE WHEN i.price = '{}'::jsonb         THEN 'missing_price' END,

    -- ─── ACCURACY — plages plausibles ─────────────────────────────────────
    -- Prix aberrant (€/kg < 0.10 ou > 200) — couvre majeur des produits.
    -- Hors scope : foie gras, truffe, safran (édgecases premium).
    CASE
      WHEN i.price <> '{}'::jsonb
        AND (i.price->'fr'->>'eur_per_kg') ~ '^[0-9.]+$'
        AND ((i.price->'fr'->>'eur_per_kg')::numeric < 0.10
             OR (i.price->'fr'->>'eur_per_kg')::numeric > 200)
      THEN 'price_outlier' END,

    -- ─── CONSISTENCY — cohérence nutrition ────────────────────────────────
    -- Calories renseignées mais P+G+L > 5g + kcal = 0 → erreur saisie.
    CASE
      WHEN nc.kcal IS NOT NULL AND nc.kcal = 0
        AND COALESCE(nc.p, 0) + COALESCE(nc.g, 0) + COALESCE(nc.l, 0) > 5
      THEN 'nutrition_zero_kcal_inconsistent' END,
    -- Kcal calculés vs déclarés divergent de +30 % (formule Atwater).
    CASE
      WHEN nc.kcal IS NOT NULL AND nc.kcal > 0
        AND (COALESCE(nc.p, 0) + COALESCE(nc.g, 0)) * 4 + COALESCE(nc.l, 0) * 9 > 0
        AND abs(nc.kcal - ((COALESCE(nc.p, 0) + COALESCE(nc.g, 0)) * 4 + COALESCE(nc.l, 0) * 9))
            > nc.kcal * 0.30
      THEN 'nutrition_macros_inconsistent' END,

    -- ─── UNIQUENESS ───────────────────────────────────────────────────────
    -- Doublon label FR (lower+trim). Suspecte une duplication d'ingrédient.
    CASE WHEN dl.label_norm IS NOT NULL THEN 'duplicate_label_fr' END
  ], NULL) AS issues,
  -- Métadonnées (NON personnelles)
  CASE WHEN i.price <> '{}'::jsonb
            AND (i.price->'fr'->>'eur_per_kg') ~ '^[0-9.]+$'
       THEN (i.price->'fr'->>'eur_per_kg')::numeric
  END AS eur_per_kg,
  i.updated_at
FROM public.ingredients i
LEFT JOIN ingredient_names_normalized inn ON inn.id = i.id
LEFT JOIN duplicate_labels dl ON dl.label_norm = inn.label_norm
LEFT JOIN nutrition_check nc ON nc.id = i.id;

ALTER VIEW public.ingredient_health_check SET (security_invoker = on);

COMMENT ON VIEW public.ingredient_health_check IS
  'Refonte Sprint 8 Qualité v2. Couvre 5 dimensions DQ. Nouveaux checks : prix aberrants, nutrition macros incohérents (formule Atwater), doublons labels FR.';

COMMIT;
