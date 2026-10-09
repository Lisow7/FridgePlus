-- ============================================================
-- v3.71.0 — Renommage gp-nutella → gp-pate-tartiner-choco
-- ------------------------------------------------------------
-- Suite Phase 8.5.5.C : la marque Nutella est une marque déposée
-- Ferrero. L'ID `gp-nutella` a été renommé en `gp-pate-tartiner-choco`
-- côté code (ingredients.js, nutrition.js, dietBreakingIds.js,
-- pricing/2026.json, scripts pricing-batch-4 + migrate-to-db).
--
-- Cette migration propage le renommage côté Supabase :
--   1. Migre les FK (user_stock, basket_items) vers le nouvel ID
--   2. UPDATE jsonb sur base_recipes.ingredients (colonne directe)
--   3. UPDATE jsonb sur custom_recipes.data (colonne monolithique
--      qui contient ingredients à l'intérieur — cf. pattern
--      v3.28.0_ingredient_cleanup, lignes 67-75)
--   4. DELETE de la row orpheline `gp-nutella` de `ingredients`
--      (le sync-ingredients aura déjà inséré gp-pate-tartiner-choco)
--   5. Idempotent : safe à re-run.
--
-- RGPD inchangé. Aucun impact PII. Aucune cascade FK problématique.
-- ============================================================

-- ─── 1. Migrer les FK directes (user_stock + basket_items) ────────────
DO $$
DECLARE
  v_stock  int;
  v_basket int;
  v_custom int;
BEGIN
  -- user_stock.ingredient_id (data utilisateur — on migre, pas d'avort)
  SELECT COUNT(*) INTO v_stock FROM public.user_stock
   WHERE ingredient_id = 'gp-nutella';
  IF v_stock > 0 THEN
    UPDATE public.user_stock
       SET ingredient_id = 'gp-pate-tartiner-choco'
     WHERE ingredient_id = 'gp-nutella';
    RAISE NOTICE 'v3.71.0: % entrées user_stock migrées vers gp-pate-tartiner-choco.', v_stock;
  END IF;

  -- basket_items.ingredient_id (data utilisateur)
  SELECT COUNT(*) INTO v_basket FROM public.basket_items
   WHERE ingredient_id = 'gp-nutella';
  IF v_basket > 0 THEN
    UPDATE public.basket_items
       SET ingredient_id = 'gp-pate-tartiner-choco'
     WHERE ingredient_id = 'gp-nutella';
    RAISE NOTICE 'v3.71.0: % entrées basket_items migrées vers gp-pate-tartiner-choco.', v_basket;
  END IF;

  -- custom_recipes.data : remplacement chaîne brute (jsonb monolithique)
  SELECT COUNT(*) INTO v_custom FROM public.custom_recipes
   WHERE data::text LIKE '%gp-nutella%';
  IF v_custom > 0 THEN
    UPDATE public.custom_recipes
       SET data = REPLACE(data::text, 'gp-nutella', 'gp-pate-tartiner-choco')::jsonb
     WHERE data::text LIKE '%gp-nutella%';
    RAISE NOTICE 'v3.71.0: % custom_recipes mises à jour (data jsonb).', v_custom;
  END IF;
END $$;

-- ─── 2. UPDATE base_recipes.ingredients (colonne JSONB directe) ───────
-- Format : [{ ids: ['fr-x','gp-y'], qty }, ...]
-- On reconstruit chaque slot en remplaçant 'gp-nutella' dans son array `ids`.
UPDATE public.base_recipes
SET ingredients = (
  SELECT jsonb_agg(
    CASE
      WHEN slot ? 'ids' THEN
        jsonb_set(
          slot,
          '{ids}',
          (
            SELECT jsonb_agg(
              CASE WHEN id_value::text = '"gp-nutella"' THEN '"gp-pate-tartiner-choco"'::jsonb
                   ELSE id_value
              END
            )
            FROM jsonb_array_elements(slot->'ids') AS id_value
          )
        )
      ELSE slot
    END
  )
  FROM jsonb_array_elements(ingredients) AS slot
)
WHERE ingredients::text LIKE '%gp-nutella%';

-- ─── 3. Supprimer la row orpheline de la table ingredients ────────────
-- À ce stade, plus aucune FK ni JSONB ne pointe vers gp-nutella.
-- Le sync-ingredients a déjà inséré gp-pate-tartiner-choco en parallèle.
DELETE FROM public.ingredients WHERE id = 'gp-nutella';

-- ─── 4. Vérification finale (à lire dans la sortie SQL Editor) ────────
-- Devrait renvoyer 0 partout.
SELECT
  (SELECT COUNT(*) FROM public.ingredients     WHERE id = 'gp-nutella')                            AS orphan_ingredient,
  (SELECT COUNT(*) FROM public.base_recipes    WHERE ingredients::text LIKE '%gp-nutella%')        AS base_recipes_left,
  (SELECT COUNT(*) FROM public.custom_recipes  WHERE data::text       LIKE '%gp-nutella%')         AS custom_recipes_left,
  (SELECT COUNT(*) FROM public.user_stock      WHERE ingredient_id = 'gp-nutella')                 AS user_stock_left,
  (SELECT COUNT(*) FROM public.basket_items    WHERE ingredient_id = 'gp-nutella')                 AS basket_items_left;

-- [release-action: appliquer cette migration sur Supabase Studio (SQL Editor)]
