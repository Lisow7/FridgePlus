-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260628032039) : appliquée
-- sans fichier dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- Elle est en base : ne pas la rejouer.
-- ── SQL du registre, recopié tel quel (md5 926646410ef53a6e5ccfc307a3c5f97f) ──
-- Trigger inerte : derive_recipe_allergens_and_diets lit item->>'id' (singulier)
-- alors que recipes_unified.ingredients utilise des slots `ids: [...]` (alternatives)
-- → v_ingredient_ids NULL → RETURN NEW. N'a jamais modifié de données.
-- De plus son vocabulaire (gluten_free underscore, keto/paleo/kosher…) est
-- incompatible avec les données live (tirets, 5 régimes). Le « réveiller » naïvement
-- corromprait toutes les recettes. On le supprime (allergens/diet sont curés +
-- backfillés manuellement ; le modal/carte dérivent à l'affichage).
DROP TRIGGER IF EXISTS recipes_unified_derive_allergens_diets ON public.recipes_unified;
DROP FUNCTION IF EXISTS public.derive_recipe_allergens_and_diets();
