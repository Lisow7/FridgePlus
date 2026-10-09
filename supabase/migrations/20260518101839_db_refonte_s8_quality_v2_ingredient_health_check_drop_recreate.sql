-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260518101839) : appliquée
-- sans fichier dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- Elle est en base : ne pas la rejouer.
-- ── SQL du registre, recopié tel quel (md5 e8ab24afca5ab1e67d569bddbb66f436) ──
DROP VIEW IF EXISTS public.ingredient_health_check;

CREATE VIEW public.ingredient_health_check
  WITH (security_invoker = on)
AS
WITH
  ingredient_names_normalized AS (
    SELECT id, lower(trim(labels->>'fr')) AS label_norm
    FROM public.ingredients
  ),
  duplicate_labels AS (
    SELECT label_norm FROM ingredient_names_normalized
    WHERE label_norm IS NOT NULL AND label_norm <> ''
    GROUP BY label_norm HAVING count(*) > 1
  ),
  nutrition_check AS (
    SELECT id,
      (i.nutrition->>'calories')::numeric AS kcal,
      (i.nutrition->>'protein')::numeric  AS p,
      (i.nutrition->>'carbs')::numeric    AS g,
      (i.nutrition->>'fat')::numeric      AS l
    FROM public.ingredients i
    WHERE i.nutrition <> '{}'::jsonb
      AND (i.nutrition->>'calories') ~ '^[0-9.]+$'
  )
SELECT i.id, i.labels->>'fr' AS label_fr, i.subcategory, i.storage,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN COALESCE(i.labels->>'fr','')='' THEN 'missing_label_fr' END,
    CASE WHEN COALESCE(i.labels->>'en','')='' THEN 'missing_label_en' END,
    CASE WHEN COALESCE(i.emoji, '') IN ('', '🥄') THEN 'missing_emoji' END,
    CASE WHEN i.nutrition = '{}'::jsonb     THEN 'missing_nutrition' END,
    CASE WHEN i.pack_size = '{}'::jsonb     THEN 'missing_pack_size' END,
    CASE WHEN i.default_unit IS NULL        THEN 'missing_default_unit' END,
    CASE WHEN i.price = '{}'::jsonb         THEN 'missing_price' END,
    CASE
      WHEN i.price <> '{}'::jsonb
        AND (i.price->'fr'->>'eur_per_kg') ~ '^[0-9.]+$'
        AND ((i.price->'fr'->>'eur_per_kg')::numeric < 0.10
             OR (i.price->'fr'->>'eur_per_kg')::numeric > 200)
      THEN 'price_outlier' END,
    CASE
      WHEN nc.kcal IS NOT NULL AND nc.kcal = 0
        AND COALESCE(nc.p, 0) + COALESCE(nc.g, 0) + COALESCE(nc.l, 0) > 5
      THEN 'nutrition_zero_kcal_inconsistent' END,
    CASE
      WHEN nc.kcal IS NOT NULL AND nc.kcal > 0
        AND (COALESCE(nc.p, 0) + COALESCE(nc.g, 0)) * 4 + COALESCE(nc.l, 0) * 9 > 0
        AND abs(nc.kcal - ((COALESCE(nc.p, 0) + COALESCE(nc.g, 0)) * 4 + COALESCE(nc.l, 0) * 9))
            > nc.kcal * 0.30
      THEN 'nutrition_macros_inconsistent' END,
    CASE WHEN dl.label_norm IS NOT NULL THEN 'duplicate_label_fr' END
  ], NULL) AS issues,
  i.updated_at,
  CASE WHEN i.price <> '{}'::jsonb
            AND (i.price->'fr'->>'eur_per_kg') ~ '^[0-9.]+$'
       THEN (i.price->'fr'->>'eur_per_kg')::numeric
  END AS eur_per_kg
FROM public.ingredients i
LEFT JOIN ingredient_names_normalized inn ON inn.id = i.id
LEFT JOIN duplicate_labels dl ON dl.label_norm = inn.label_norm
LEFT JOIN nutrition_check nc ON nc.id = i.id;

COMMENT ON VIEW public.ingredient_health_check IS
  'Refonte Sprint 8 Qualité v2. 5 dimensions DQ. Nouveaux : prix aberrants, nutrition macros incohérents (formule Atwater ±30%), doublons labels FR.';
