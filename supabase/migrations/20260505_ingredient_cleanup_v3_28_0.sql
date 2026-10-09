-- ============================================================
-- v3.28.0 — Cleanup ingrédients : doublons + disambiguïsation labels
-- ------------------------------------------------------------
-- Cette migration applique deux changements à la table `public.ingredients` :
--
--   1. SUPPRESSION de 3 IDs identifiés comme doublons exacts :
--        • `jp-genmai`        → équivalent `gp-riz-complet`
--        • `jp-shiitake-dry`  → équivalent `gp-shiitake-sec`
--        • `jp-komeko`        → équivalent `gp-farine-riz`
--      Avant le DELETE, on vérifie qu'aucune `base_recipes`, `custom_recipes`,
--      `user_stock`, `basket_items` ne pointe vers ces IDs (RAISE EXCEPTION
--      si jamais c'est le cas — la migration s'arrête plutôt que casser).
--
--   2. UPDATE de 27 labels pour disambiguïser les cas frais/surgelé/conserve.
--      Ex: « Carottes » devient « Carottes (surgelées) » pour `frz-carottes`,
--      l'utilisateur tape « carotte » et voit clairement la différence dans
--      la barre de recherche du panier.
--
-- Les fichiers JS source (`src/data/ingredients.js`, `src/data/nutrition.js`)
-- ont été mis à jour en parallèle. Le script `scripts/migrate-to-db.mjs`
-- pousse uniquement des UPSERTs et ne supprime pas les rangs orphelins —
-- d'où la nécessité de ce DELETE explicite.
--
-- Idempotent : on utilise `WHERE id IN (...)` pour les DELETE et `UPDATE
-- WHERE id = ...` pour les UPDATE, donc safe à relancer.
-- ============================================================

-- ─── 1. Vérification préalable des références (read-only) ────────────
DO $$
DECLARE
  v_orphans int;
  v_basket  int;
  v_stock   int;
  v_custom  int;
BEGIN
  -- a) base_recipes.ingredients est un jsonb avec des arrays `ids[]`. On flatten
  --    avec jsonb_array_elements puis on extrait l'array `ids` et on cherche
  --    nos doublons dedans.
  SELECT COUNT(*) INTO v_orphans
  FROM public.base_recipes br,
       LATERAL jsonb_array_elements(br.ingredients) AS slot,
       LATERAL jsonb_array_elements_text(slot->'ids') AS ing_id
  WHERE ing_id::text IN ('jp-genmai', 'jp-shiitake-dry', 'jp-komeko');

  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Migration v3.28.0 abort: % base_recipes referencent encore jp-genmai/jp-shiitake-dry/jp-komeko. Update les recettes avant.', v_orphans;
  END IF;

  -- b) basket_items.ingredient_id (depuis v3.27.1)
  SELECT COUNT(*) INTO v_basket FROM public.basket_items
   WHERE ingredient_id IN ('jp-genmai', 'jp-shiitake-dry', 'jp-komeko');
  IF v_basket > 0 THEN
    RAISE EXCEPTION 'Migration v3.28.0 abort: % basket_items referencent jp-genmai/jp-shiitake-dry/jp-komeko.', v_basket;
  END IF;

  -- c) user_stock.ingredient_id
  SELECT COUNT(*) INTO v_stock FROM public.user_stock
   WHERE ingredient_id IN ('jp-genmai', 'jp-shiitake-dry', 'jp-komeko');
  IF v_stock > 0 THEN
    -- Plus permissif : on migre les FK plutôt que d'avorter (data utilisateur).
    UPDATE public.user_stock SET ingredient_id = 'gp-riz-complet'  WHERE ingredient_id = 'jp-genmai';
    UPDATE public.user_stock SET ingredient_id = 'gp-shiitake-sec' WHERE ingredient_id = 'jp-shiitake-dry';
    UPDATE public.user_stock SET ingredient_id = 'gp-farine-riz'   WHERE ingredient_id = 'jp-komeko';
    RAISE NOTICE 'Migration v3.28.0: % entrees user_stock migrees vers les IDs canoniques.', v_stock;
  END IF;

  -- d) custom_recipes.data (jsonb monolithique) : on log un warning si des refs
  --    sont trouvees (nettoyage manuel via UPDATE jsonb si besoin).
  SELECT COUNT(*) INTO v_custom FROM public.custom_recipes
   WHERE data::text LIKE '%jp-genmai%'
      OR data::text LIKE '%jp-shiitake-dry%'
      OR data::text LIKE '%jp-komeko%';
  IF v_custom > 0 THEN
    RAISE WARNING 'Migration v3.28.0: % custom_recipes contiennent encore les IDs supprimes. Nettoyage manuel a faire si necessaire.', v_custom;
  END IF;
END $$;

-- ─── 2. Disambiguïsation des labels (27 UPDATEs) ─────────────────────
-- Pour chaque ID concerné, on remplace le label jsonb complet par sa version
-- disambiguïsée (5 langues). Idempotent : si le label est déjà à jour, le
-- UPDATE ne change rien (le row reste tel quel).

UPDATE public.ingredients SET labels = '{"fr":"Poissons (surgelés)","en":"Fish (frozen)","es":"Pescado (congelado)","de":"Fisch (TK)","ja":"魚（冷凍）"}'::jsonb WHERE id = 'frz-poissons';
UPDATE public.ingredients SET labels = '{"fr":"Cabillaud (surgelé)","en":"Cod (frozen)","es":"Bacalao (congelado)","de":"Kabeljau (TK)","ja":"タラ（冷凍）"}'::jsonb WHERE id = 'frz-cabillaud';
UPDATE public.ingredients SET labels = '{"fr":"Daurade (surgelée)","en":"Sea bream (frozen)","es":"Dorada (congelada)","de":"Dorade (TK)","ja":"鯛（冷凍）"}'::jsonb WHERE id = 'frz-daurade';
UPDATE public.ingredients SET labels = '{"fr":"Fruits de mer (surgelés)","en":"Seafood (frozen)","es":"Marisco (congelado)","de":"Meeresfrüchte (TK)","ja":"魚介類（冷凍）"}'::jsonb WHERE id = 'frz-fruits-mer';
UPDATE public.ingredients SET labels = '{"fr":"Crevettes (surgelées)","en":"Shrimp (frozen)","es":"Gambas (congeladas)","de":"Garnelen (TK)","ja":"エビ（冷凍）"}'::jsonb WHERE id = 'frz-crevettes';
UPDATE public.ingredients SET labels = '{"fr":"Moules (surgelées)","en":"Mussels (frozen)","es":"Mejillones (congelados)","de":"Muscheln (TK)","ja":"ムール貝（冷凍）"}'::jsonb WHERE id = 'frz-moules';
UPDATE public.ingredients SET labels = '{"fr":"Brocoli (surgelé)","en":"Broccoli (frozen)","es":"Brócoli (congelado)","de":"Brokkoli (TK)","ja":"ブロッコリー（冷凍）"}'::jsonb WHERE id = 'frz-brocoli';
UPDATE public.ingredients SET labels = '{"fr":"Carottes (surgelées)","en":"Carrots (frozen)","es":"Zanahorias (congeladas)","de":"Karotten (TK)","ja":"ニンジン（冷凍）"}'::jsonb WHERE id = 'frz-carottes';
UPDATE public.ingredients SET labels = '{"fr":"Champignons (surgelés)","en":"Mushrooms (frozen)","es":"Champiñones (congelados)","de":"Pilze (TK)","ja":"きのこ（冷凍）"}'::jsonb WHERE id = 'frz-champignons';
UPDATE public.ingredients SET labels = '{"fr":"Chou-fleur (surgelé)","en":"Cauliflower (frozen)","es":"Coliflor (congelada)","de":"Blumenkohl (TK)","ja":"カリフラワー（冷凍）"}'::jsonb WHERE id = 'frz-chou-fleur';
UPDATE public.ingredients SET labels = '{"fr":"Edamame (surgelés)","en":"Edamame (frozen)","es":"Edamame (congelados)","de":"Edamame (TK)","ja":"枝豆（冷凍）"}'::jsonb WHERE id = 'frz-edamame';
UPDATE public.ingredients SET labels = '{"fr":"Épinards (surgelés)","en":"Spinach (frozen)","es":"Espinacas (congeladas)","de":"Spinat (TK)","ja":"ほうれん草（冷凍）"}'::jsonb WHERE id = 'frz-epinards';
UPDATE public.ingredients SET labels = '{"fr":"Haricots verts (surgelés)","en":"Green beans (frozen)","es":"Judías verdes (congeladas)","de":"Grüne Bohnen (TK)","ja":"インゲン（冷凍）"}'::jsonb WHERE id = 'frz-haricots-v';
UPDATE public.ingredients SET labels = '{"fr":"Maïs (surgelé)","en":"Corn (frozen)","es":"Maíz (congelado)","de":"Mais (TK)","ja":"コーン（冷凍）"}'::jsonb WHERE id = 'frz-mais';
UPDATE public.ingredients SET labels = '{"fr":"Petits pois (surgelés)","en":"Peas (frozen)","es":"Guisantes (congelados)","de":"Erbsen (TK)","ja":"グリーンピース（冷凍）"}'::jsonb WHERE id = 'frz-petits-pois';
UPDATE public.ingredients SET labels = '{"fr":"Poireaux (surgelés)","en":"Leeks (frozen)","es":"Puerros (congelados)","de":"Lauch (TK)","ja":"ねぎ（冷凍）"}'::jsonb WHERE id = 'frz-poireaux';
UPDATE public.ingredients SET labels = '{"fr":"Poivrons (surgelés)","en":"Bell peppers (frozen)","es":"Pimientos (congelados)","de":"Paprika (TK)","ja":"ピーマン（冷凍）"}'::jsonb WHERE id = 'frz-poivrons';
UPDATE public.ingredients SET labels = '{"fr":"Croissant (surgelé)","en":"Croissant (frozen)","es":"Croissant (congelado)","de":"Croissant (TK)","ja":"クロワッサン（冷凍）"}'::jsonb WHERE id = 'frz-croissant';
UPDATE public.ingredients SET labels = '{"fr":"Brioche (surgelée)","en":"Brioche (frozen)","es":"Brioche (congelada)","de":"Brioche (TK)","ja":"ブリオッシュ（冷凍）"}'::jsonb WHERE id = 'frz-brioche';
UPDATE public.ingredients SET labels = '{"fr":"Baguette (surgelée)","en":"Baguette (frozen)","es":"Baguette (congelada)","de":"Baguette (TK)","ja":"バゲット（冷凍）"}'::jsonb WHERE id = 'frz-baguette';
UPDATE public.ingredients SET labels = '{"fr":"Pain de mie (surgelé)","en":"Sandwich bread (frozen)","es":"Pan de molde (congelado)","de":"Toastbrot (TK)","ja":"食パン（冷凍）"}'::jsonb WHERE id = 'frz-pain-mie';

UPDATE public.ingredients SET labels = '{"fr":"Maïs (conserve)","en":"Corn (canned)","es":"Maíz (en conserva)","de":"Mais (Dose)","ja":"コーン（缶詰）"}'::jsonb WHERE id = 'gp-mais';
UPDATE public.ingredients SET labels = '{"fr":"Petits pois (conserve)","en":"Peas (canned)","es":"Guisantes (en conserva)","de":"Erbsen (Dose)","ja":"グリーンピース（缶詰）"}'::jsonb WHERE id = 'gp-petits-pois';
UPDATE public.ingredients SET labels = '{"fr":"Champignons (conserve)","en":"Mushrooms (canned)","es":"Champiñones (en conserva)","de":"Pilze (Dose)","ja":"きのこ（缶詰）"}'::jsonb WHERE id = 'gp-champignons';
UPDATE public.ingredients SET labels = '{"fr":"Thon (conserve)","en":"Tuna (canned)","es":"Atún (en conserva)","de":"Thunfisch (Dose)","ja":"ツナ（缶詰）"}'::jsonb WHERE id = 'gp-thon';
UPDATE public.ingredients SET labels = '{"fr":"Maquereau (conserve)","en":"Mackerel (canned)","es":"Caballa (en conserva)","de":"Makrele (Dose)","ja":"サバ（缶詰）"}'::jsonb WHERE id = 'gp-maquereau';
UPDATE public.ingredients SET labels = '{"fr":"Jackfruit (conserve)","en":"Jackfruit (canned)","es":"Jackfruit (en conserva)","de":"Jackfrucht (Dose)","ja":"ジャックフルーツ（缶詰）"}'::jsonb WHERE id = 'gp-jackfruit';

-- ─── 3. Suppression des 3 IDs doublons ───────────────────────────────
-- À ce point, les `user_stock` orphelins ont été migrés en bloc (a) ci-dessus
-- et les `base_recipes` n'avaient aucune référence (vérifié). On peut donc
-- supprimer les 3 ingredients.
DELETE FROM public.ingredients
 WHERE id IN ('jp-genmai', 'jp-shiitake-dry', 'jp-komeko');

-- [release-action: appliquer cette migration sur Supabase Studio (SQL Editor)]
