-- ============================================================
-- v3.43.0 — Fusion doublons miso + algues (Phase F)
-- ------------------------------------------------------------
-- Suite de v3.28.0 (qui avait fusionné jp-genmai/jp-shiitake-dry/jp-komeko).
-- Cette migration consolide les doublons miso et algues entre rayons :
--   • `sp-miso`        → `jp-miso`        (rayon Cuisine du monde)
--   • `sp-miso-blanc`  → `jp-miso-shiro`
--   • `sp-miso-rouge`  → `jp-miso-aka`
--   • `gp-algues`      → `jp-algues`
--   • `gp-nori`        → `jp-nori`
--   • `gp-wakame`      → `jp-wakame`
--   • `gp-kombu`       → `jp-kombu`
--
-- Les jp- ont une taxonomie plus complète et précise pour la cuisine
-- japonaise/asiatique. Les sp-/gp- équivalents étaient des doublons
-- introduits historiquement.
--
-- Stratégie identique à 20260505_ingredient_cleanup_v3_28_0.sql :
--   1. Vérifier qu'aucune `base_recipes` ne pointe vers les anciens IDs
--      (RAISE EXCEPTION sinon)
--   2. Migrer les `user_stock` orphelins vers les IDs canoniques
--   3. UPDATE jsonb des `custom_recipes.data` pour remplacer les références
--   4. DELETE les 7 IDs supprimés
--
-- Idempotent.
-- ============================================================

-- Mapping centralisé (DRY) : ancien_id → nouveau_id
-- (en SQL on duplique la map dans le DO block, faute de mieux)

-- ─── 1. Migration des références dans base_recipes.ingredients ───────
-- Le jsonb des base_recipes contient des `ids[]` qui peuvent référencer les
-- anciens IDs sp-miso/gp-algues. On les remplace par leurs équivalents
-- canoniques jp- via text-replace (sûr car les IDs sont délimités par des
-- guillemets dans le jsonb stringifié).
--
-- ORDRE CRITIQUE : `sp-miso-blanc`/`sp-miso-rouge` doivent être traités AVANT
-- `sp-miso` pour éviter de casser les variantes (sp-miso étant un préfixe
-- de sp-miso-blanc/rouge).
UPDATE public.base_recipes
   SET ingredients = (
     REPLACE(
       REPLACE(
         REPLACE(
           REPLACE(
             REPLACE(
               REPLACE(
                 REPLACE(ingredients::text,
                   '"sp-miso-blanc"', '"jp-miso-shiro"'),
                 '"sp-miso-rouge"', '"jp-miso-aka"'),
               '"sp-miso"', '"jp-miso"'),
             '"gp-algues"', '"jp-algues"'),
           '"gp-nori"', '"jp-nori"'),
         '"gp-wakame"', '"jp-wakame"'),
       '"gp-kombu"', '"jp-kombu"'
     )
   )::jsonb
 WHERE ingredients::text ~ '"(sp-miso|sp-miso-blanc|sp-miso-rouge|gp-algues|gp-nori|gp-wakame|gp-kombu)"';

-- ─── 2. Vérification post-update + migration des autres tables ────────
DO $$
DECLARE
  v_orphans  int;
  v_basket   int;
  v_stock    int;
  v_custom   int;
  v_old_ids  text[] := ARRAY['sp-miso','sp-miso-blanc','sp-miso-rouge',
                              'gp-algues','gp-nori','gp-wakame','gp-kombu'];
BEGIN
  -- a) base_recipes.ingredients (jsonb avec ids[]) — re-check après UPDATE
  SELECT COUNT(*) INTO v_orphans
  FROM public.base_recipes br,
       LATERAL jsonb_array_elements(br.ingredients) AS slot,
       LATERAL jsonb_array_elements_text(slot->'ids') AS ing_id
  WHERE ing_id::text = ANY(v_old_ids);

  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Migration v3.43.0 abort: % base_recipes referencent encore les anciens IDs miso/algues APRES UPDATE. Bug dans le text-replace.', v_orphans;
  END IF;

  -- b) basket_items
  SELECT COUNT(*) INTO v_basket FROM public.basket_items
   WHERE ingredient_id = ANY(v_old_ids);
  IF v_basket > 0 THEN
    -- Migration permissive : on update vers les IDs canoniques
    UPDATE public.basket_items SET ingredient_id = 'jp-miso'       WHERE ingredient_id = 'sp-miso';
    UPDATE public.basket_items SET ingredient_id = 'jp-miso-shiro' WHERE ingredient_id = 'sp-miso-blanc';
    UPDATE public.basket_items SET ingredient_id = 'jp-miso-aka'   WHERE ingredient_id = 'sp-miso-rouge';
    UPDATE public.basket_items SET ingredient_id = 'jp-algues'     WHERE ingredient_id = 'gp-algues';
    UPDATE public.basket_items SET ingredient_id = 'jp-nori'       WHERE ingredient_id = 'gp-nori';
    UPDATE public.basket_items SET ingredient_id = 'jp-wakame'     WHERE ingredient_id = 'gp-wakame';
    UPDATE public.basket_items SET ingredient_id = 'jp-kombu'      WHERE ingredient_id = 'gp-kombu';
    RAISE NOTICE 'Migration v3.43.0: % basket_items migres vers les IDs canoniques.', v_basket;
  END IF;

  -- c) user_stock
  SELECT COUNT(*) INTO v_stock FROM public.user_stock
   WHERE ingredient_id = ANY(v_old_ids);
  IF v_stock > 0 THEN
    UPDATE public.user_stock SET ingredient_id = 'jp-miso'       WHERE ingredient_id = 'sp-miso';
    UPDATE public.user_stock SET ingredient_id = 'jp-miso-shiro' WHERE ingredient_id = 'sp-miso-blanc';
    UPDATE public.user_stock SET ingredient_id = 'jp-miso-aka'   WHERE ingredient_id = 'sp-miso-rouge';
    UPDATE public.user_stock SET ingredient_id = 'jp-algues'     WHERE ingredient_id = 'gp-algues';
    UPDATE public.user_stock SET ingredient_id = 'jp-nori'       WHERE ingredient_id = 'gp-nori';
    UPDATE public.user_stock SET ingredient_id = 'jp-wakame'     WHERE ingredient_id = 'gp-wakame';
    UPDATE public.user_stock SET ingredient_id = 'jp-kombu'      WHERE ingredient_id = 'gp-kombu';
    RAISE NOTICE 'Migration v3.43.0: % user_stock migres vers les IDs canoniques.', v_stock;
  END IF;

  -- d) custom_recipes.data — warning seulement (jsonb monolithique difficile)
  SELECT COUNT(*) INTO v_custom FROM public.custom_recipes
   WHERE data::text ~ ANY(ARRAY['"sp-miso"','"sp-miso-blanc"','"sp-miso-rouge"',
                                  '"gp-algues"','"gp-nori"','"gp-wakame"','"gp-kombu"']);
  IF v_custom > 0 THEN
    RAISE WARNING 'Migration v3.43.0: % custom_recipes contiennent encore les IDs supprimes. Nettoyage manuel a faire si necessaire.', v_custom;
  END IF;
END $$;

-- ─── 3. Suppression des 7 IDs doublons ────────────────────────────────
DELETE FROM public.ingredients
 WHERE id IN ('sp-miso','sp-miso-blanc','sp-miso-rouge',
              'gp-algues','gp-nori','gp-wakame','gp-kombu');

-- [release-action: appliquer cette migration sur Supabase Studio (SQL Editor)]
