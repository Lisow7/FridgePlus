-- Corrige la vue `recipe_health_check`, cassée en production : toute lecture
-- des colonnes échouait en `22023 — cannot extract elements from an object`,
-- rendant l'onglet Qualité du panneau admin inopérant (et pire : il affichait
-- « Qualité parfaite · 100 % » puisque l'erreur était ignorée côté UI).
--
-- CAUSE — la vue applique `jsonb_array_elements(r.ingredients)` dans 3 CTE en
-- supposant que `ingredients` est TOUJOURS un tableau. Or le modèle de données
-- accepte aussi le format enrichi (D19) :
--     { "groups": [{ "name": {...}, "items": [...] }], "sub_recipes": [...] }
-- `lasagnes-legumes` (officielle, publiée) l'utilise — groupe « Pour la
-- béchamel » + sous-recette `bechamel-maison`. Ce n'est PAS une donnée
-- corrompue : le front gère ce format depuis toujours
-- (`src/shared/lib/recipes/recipe-ingredients.js`). C'est la vue SQL qui était
-- restée sur l'ancien modèle. Une seule recette suffisait à faire tomber
-- l'analyse des 515.
--
-- Subtilité qui explique que le bug soit passé inaperçu : `count(*)` sur la vue
-- fonctionnait (Postgres n'évalue pas les colonnes concernées) — seul un
-- `select` des colonnes plantait.
--
-- CORRECTIF — aplatissement tolérant aux deux formats, alignant la vue sur
-- `getIngredientItemsFlat()` du front : les items de tous les groupes, dans
-- l'ordre. Les `sub_recipes` sont volontairement EXCLUES, exactement comme côté
-- front où elles relèvent d'un helper séparé (`getSubRecipes`) — sans quoi
-- l'outil d'audit compterait des ingrédients que l'utilisateur ne voit pas dans
-- la liste de la recette.
--
-- Colonnes, types et ordre inchangés (remplacement à l'identique).

-- Helper : équivalent SQL de `getIngredientItemsFlat()`. Renvoie TOUJOURS un
-- tableau jsonb d'items, quel que soit le format stocké.
--   - legacy  : `[ {...}, {...} ]`            → renvoyé tel quel
--   - enrichi : `{ groups: [ { items: [...] } ] }` → items aplatis, ordre des
--               groupes puis ordre intra-groupe préservé (comme le front)
--   - autre / null / groups absent            → `[]` (jamais d'erreur)
-- IMMUTABLE : dépend uniquement de son argument, donc utilisable en vue sans
-- coût de re-planification.
create or replace function public.recipe_ingredient_items(ing jsonb)
returns jsonb
language sql
immutable
parallel safe
as $$
  select case
    when jsonb_typeof(ing) = 'array' then ing
    when jsonb_typeof(ing) = 'object' and jsonb_typeof(ing -> 'groups') = 'array' then
      coalesce((
        select jsonb_agg(item order by g.ord, i.ord)
        from jsonb_array_elements(ing -> 'groups') with ordinality as g(grp, ord),
             jsonb_array_elements(
               case when jsonb_typeof(g.grp -> 'items') = 'array'
                    then g.grp -> 'items' else '[]'::jsonb end
             ) with ordinality as i(item, ord)
      ), '[]'::jsonb)
    else '[]'::jsonb
  end;
$$;

comment on function public.recipe_ingredient_items(jsonb) is
  'Aplatit `recipes_unified.ingredients` (legacy array ou enrichi {groups,sub_recipes}) en tableau d''items. Pendant SQL de getIngredientItemsFlat(). Les sub_recipes sont exclues, comme côté front.';

create or replace view public.recipe_health_check as
 WITH valid_ingredient_ids AS (
         SELECT ingredients.id
           FROM ingredients
        ), recipe_names_normalized AS (
         SELECT recipes_unified.id,
            lower(TRIM(BOTH FROM recipes_unified.name ->> 'fr'::text)) AS name_norm
           FROM recipes_unified
          WHERE recipes_unified.deleted_at IS NULL
        ), duplicate_names AS (
         SELECT recipe_names_normalized.name_norm
           FROM recipe_names_normalized
          WHERE recipe_names_normalized.name_norm IS NOT NULL AND recipe_names_normalized.name_norm <> ''::text
          GROUP BY recipe_names_normalized.name_norm
         HAVING count(*) > 1
        ), recipe_ingredient_refs AS (
         SELECT r_1.id AS recipe_id,
            ing.value ->> 'id'::text AS ingredient_id
           FROM recipes_unified r_1,
            LATERAL jsonb_array_elements(public.recipe_ingredient_items(r_1.ingredients)) ing(value)
          WHERE r_1.deleted_at IS NULL AND ing.value ? 'id'::text
        ), orphan_ingredients_per_recipe AS (
         SELECT rir.recipe_id,
            count(*) AS orphan_count
           FROM recipe_ingredient_refs rir
             LEFT JOIN valid_ingredient_ids v ON v.id = rir.ingredient_id
          WHERE v.id IS NULL
          GROUP BY rir.recipe_id
        ), invalid_ingredient_slots_per_recipe AS (
         SELECT r_1.id AS recipe_id,
            count(*) AS bad_slots
           FROM recipes_unified r_1,
            LATERAL jsonb_array_elements(public.recipe_ingredient_items(r_1.ingredients)) ing(value)
          WHERE r_1.deleted_at IS NULL AND ((ing.value ->> 'amount'::text) IS NULL OR (ing.value ->> 'amount'::text) = ''::text) AND ((ing.value ->> 'unit'::text) IS NULL OR (ing.value ->> 'unit'::text) = ''::text) AND ((ing.value ->> 'qty'::text) IS NULL OR (ing.value ->> 'qty'::text) = ''::text)
          GROUP BY r_1.id
        ), diet_consistency AS (
         SELECT r_1.id AS recipe_id,
            array_agg(DISTINCT broken_diet.broken_diet) AS broken_diets
           FROM recipes_unified r_1,
            LATERAL jsonb_array_elements(public.recipe_ingredient_items(r_1.ingredients)) ing(value)
             JOIN ingredients i ON i.id = (ing.value ->> 'id'::text),
            LATERAL jsonb_array_elements_text(r_1.diet) recipe_diet(value),
            LATERAL unnest(COALESCE(i.breaks_diets, '{}'::text[])) broken_diet(broken_diet)
          WHERE r_1.deleted_at IS NULL AND recipe_diet.value = broken_diet.broken_diet
          GROUP BY r_1.id
        )
 SELECT r.id,
    r.name ->> 'fr'::text AS name_fr,
    r.origin,
    r.status,
    r.country,
    array_remove(ARRAY[
        CASE
            WHEN jsonb_array_length(public.recipe_ingredient_items(r.ingredients)) = 0 THEN 'no_ingredients'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(r.emoji, ''::text) = ANY (ARRAY[''::text, '🍳'::text]) THEN 'missing_emoji'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.status = 'published'::text AND COALESCE(r.description ->> 'fr'::text, ''::text) = ''::text THEN 'missing_desc_fr'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.status = 'published'::text AND COALESCE(r.description ->> 'en'::text, ''::text) = ''::text THEN 'missing_desc_en'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.status = 'published'::text AND (r.steps = '{}'::jsonb OR r.steps = '[]'::jsonb OR r.steps IS NULL) THEN 'missing_steps'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.status = 'published'::text AND COALESCE(r.country, ''::text) = ''::text THEN 'missing_country'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.servings <= 0 OR r.servings > 20 THEN 'invalid_servings'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.time_min <= 0 OR r.time_min > 480 THEN 'invalid_time'::text
            ELSE NULL::text
        END,
        CASE
            WHEN r.status = 'published'::text AND jsonb_typeof(r.steps -> 'fr'::text) = 'array'::text AND jsonb_array_length(r.steps -> 'fr'::text) < 3 THEN 'steps_too_short'::text
            ELSE NULL::text
        END,
        CASE
            WHEN iisp.bad_slots IS NOT NULL AND iisp.bad_slots > 0 THEN 'ingredient_slots_missing_qty'::text
            ELSE NULL::text
        END,
        CASE
            WHEN oip.orphan_count IS NOT NULL AND oip.orphan_count > 0 THEN 'orphan_ingredients'::text
            ELSE NULL::text
        END,
        CASE
            WHEN dc.broken_diets IS NOT NULL THEN 'diet_inconsistent'::text
            ELSE NULL::text
        END,
        CASE
            WHEN dn.name_norm IS NOT NULL THEN 'duplicate_name_fr'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(jsonb_array_length(r.diet), 0) = 0 AND COALESCE(cardinality(r.allergens), 0) = 0 THEN 'missing_diet_allergens'::text
            ELSE NULL::text
        END], NULL::text) AS issues,
    COALESCE(oip.orphan_count, 0::bigint) AS orphan_count,
    COALESCE(iisp.bad_slots, 0::bigint) AS bad_slot_count,
    dc.broken_diets,
    r.updated_at
   FROM recipes_unified r
     LEFT JOIN orphan_ingredients_per_recipe oip ON oip.recipe_id = r.id
     LEFT JOIN invalid_ingredient_slots_per_recipe iisp ON iisp.recipe_id = r.id
     LEFT JOIN diet_consistency dc ON dc.recipe_id = r.id
     LEFT JOIN recipe_names_normalized rn ON rn.id = r.id
     LEFT JOIN duplicate_names dn ON dn.name_norm = rn.name_norm
  WHERE r.deleted_at IS NULL;
