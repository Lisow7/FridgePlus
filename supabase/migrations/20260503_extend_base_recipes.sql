-- ============================================================
-- v3.3.12 — Extend `base_recipes` + FK + index + vue + MAJ RPC
-- ------------------------------------------------------------
-- Décisions I, J (cf. project_db_architecture_decisions.md) :
--
--   • Traçabilité auteur recettes promues : original_author_id + name + promoted_at
--   • Pas de table dédiée recipe_promotions (utilise activity_logs)
--   • FK country/difficulty/type pour intégrité référentielle
--
-- Note importante : la migration 20260502_promote_recipe_to_base.sql a tenté
-- d'ajouter ces colonnes mais avec un type `uuid` incompatible avec
-- `custom_recipes.id` (text). Cette migration la supersede et corrige le bug
-- (promoted_from_id text REFERENCES custom_recipes(id)).
--
-- Pré-requis :
--   • 20260503_create_master_difficulty_meal.sql (FK difficulty/type)
--   • 20260503_create_master_subcategories.sql (cohérence référentielle générale)
--   • countries_master déjà existante (créée le 1er mai)
-- ============================================================

-- ─── Colonnes auteur (RGPD : ON DELETE SET NULL pour anonymisation auto)

ALTER TABLE public.base_recipes
  ADD COLUMN IF NOT EXISTS original_author_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_author_name  text,
  ADD COLUMN IF NOT EXISTS promoted_from_id      text REFERENCES public.custom_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at           timestamptz;

CREATE INDEX IF NOT EXISTS idx_base_recipes_promoted_from
  ON public.base_recipes (promoted_from_id) WHERE promoted_from_id IS NOT NULL;

-- ─── FK vers les 3 tables maîtres (intégrité référentielle)

ALTER TABLE public.base_recipes
  DROP CONSTRAINT IF EXISTS fk_base_recipes_country;
ALTER TABLE public.base_recipes
  ADD CONSTRAINT fk_base_recipes_country
  FOREIGN KEY (country)
  REFERENCES public.countries_master(code)
  ON DELETE RESTRICT;

ALTER TABLE public.base_recipes
  DROP CONSTRAINT IF EXISTS fk_base_recipes_difficulty;
ALTER TABLE public.base_recipes
  ADD CONSTRAINT fk_base_recipes_difficulty
  FOREIGN KEY (difficulty)
  REFERENCES public.difficulty_types(key)
  ON DELETE RESTRICT;

ALTER TABLE public.base_recipes
  DROP CONSTRAINT IF EXISTS fk_base_recipes_type;
ALTER TABLE public.base_recipes
  ADD CONSTRAINT fk_base_recipes_type
  FOREIGN KEY (type)
  REFERENCES public.meal_types(key)
  ON DELETE RESTRICT;

-- ─── Index perf

CREATE INDEX IF NOT EXISTS idx_base_recipes_status
  ON public.base_recipes (status);

CREATE INDEX IF NOT EXISTS idx_base_recipes_country
  ON public.base_recipes (country) WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_base_recipes_diet
  ON public.base_recipes USING GIN (diet);

CREATE INDEX IF NOT EXISTS idx_base_recipes_allergens
  ON public.base_recipes USING GIN (allergens);

-- ─── Vue recipe_health_check ─────────────────────────────────
-- Utilisée par la future section admin Data Quality (PR 5 v3.3.16).

CREATE OR REPLACE VIEW public.recipe_health_check AS
SELECT
  r.id,
  r.name->>'fr' AS name_fr,
  r.status,
  r.country,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN jsonb_array_length(r.ingredients) = 0 THEN 'no_ingredients' END,
    CASE WHEN r.servings <= 0 OR r.servings > 20 THEN 'invalid_servings' END,
    CASE WHEN r.time_min <= 0 OR r.time_min > 480 THEN 'invalid_time' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'fr','')='' THEN 'missing_desc_fr' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'en','')='' THEN 'missing_desc_en' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'es','')='' THEN 'missing_desc_es' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'de','')='' THEN 'missing_desc_de' END,
    CASE WHEN r.status='published' AND COALESCE(r.description->>'ja','')='' THEN 'missing_desc_ja' END,
    CASE WHEN r.status='published' AND r.steps='{}'::jsonb THEN 'missing_steps' END,
    CASE WHEN r.status='published' AND COALESCE(r.country,'')='' THEN 'missing_country' END,
    CASE WHEN COALESCE(jsonb_array_length(r.diet),0) = 0 THEN 'missing_diet' END
  ], NULL) AS issues,
  r.updated_at
FROM public.base_recipes r;

ALTER VIEW public.recipe_health_check SET (security_invoker = on);

COMMENT ON VIEW public.recipe_health_check IS
  'Liste les recettes avec issues détectables (ingredients vides, descriptions manquantes par langue, etc.). Utilisée par la section admin Data Quality (PR 5).';

-- ─── RPC promote_recipe_to_base ─────────────────────────────
-- Corrige et supersede la version cassée de 20260502 (FK uuid↔text).
-- Renseigne les 4 colonnes ajoutées ci-dessus (original_author_id, name, promoted_from_id, promoted_at).

CREATE OR REPLACE FUNCTION public.promote_recipe_to_base(p_custom_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe    record;
  v_username  text;
  v_new_id    text;
  v_existing  text;
BEGIN
  -- 1. Vérifier que l'appelant est admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden — admin only' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Charger la recette communauté
  SELECT * INTO v_recipe
  FROM public.custom_recipes
  WHERE id = p_custom_id AND deleted_at IS NULL;

  IF v_recipe IS NULL THEN
    RAISE EXCEPTION 'Recipe not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Conditions de promotion
  IF v_recipe.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'Recipe must be approved before promotion (current: %)', v_recipe.moderation_status USING ERRCODE = 'P0003';
  END IF;

  IF v_recipe.consent_to_promote IS NOT TRUE THEN
    RAISE EXCEPTION 'Author has not consented to promotion (consent_to_promote = false)' USING ERRCODE = 'P0004';
  END IF;

  -- 4. Pas déjà promue
  SELECT id INTO v_existing
  FROM public.base_recipes
  WHERE promoted_from_id = p_custom_id;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('promoted', false, 'reason', 'already_promoted', 'base_id', v_existing);
  END IF;

  -- 5. Génération id text (slug + suffix random)
  v_new_id := lower(regexp_replace(coalesce(v_recipe.title, 'recipe'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substring(md5(random()::text), 1, 6);

  -- 6. Snapshot du username pour le crédit
  SELECT username INTO v_username
  FROM public.profiles
  WHERE id = v_recipe.user_id;

  -- 7. Création de la base_recipe à partir des champs JSONB de custom_recipes.data
  INSERT INTO public.base_recipes (
    id, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country, diet, allergens,
    ingredients, description, steps, image_url, status,
    original_author_id, original_author_name,
    promoted_from_id, promoted_at
  ) VALUES (
    v_new_id,
    CASE
      WHEN v_recipe.data ? 'name' AND jsonb_typeof(v_recipe.data->'name') = 'object'
        THEN v_recipe.data->'name'
      ELSE jsonb_build_object('fr', v_recipe.title, 'en', v_recipe.title, 'es', v_recipe.title, 'de', v_recipe.title, 'ja', v_recipe.title)
    END,
    coalesce(v_recipe.data->>'emoji', '🍽️'),
    coalesce(nullif(v_recipe.data->>'time_min', '')::int, 30),
    nullif(v_recipe.data->>'prep_time_min', '')::int,
    nullif(v_recipe.data->>'cook_time_min', '')::int,
    coalesce(v_recipe.data->>'difficulty', 'easy'),
    coalesce(v_recipe.data->>'type', 'main'),
    coalesce(nullif(v_recipe.data->>'servings', '')::int, 2),
    v_recipe.data->>'country',
    coalesce(v_recipe.data->'diet', '[]'::jsonb),
    coalesce(
      array(SELECT jsonb_array_elements_text(v_recipe.data->'allergens')),
      ARRAY[]::text[]
    ),
    coalesce(v_recipe.data->'ingredients', '[]'::jsonb),
    coalesce(v_recipe.data->'description', '{}'::jsonb),
    coalesce(v_recipe.data->'steps', '{}'::jsonb),
    v_recipe.data->>'image_url',
    'published',
    v_recipe.user_id,
    v_username,
    p_custom_id,
    now()
  );

  -- 8. Notif au user (type honneur)
  INSERT INTO public.notifications
    (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    v_recipe.user_id,
    'user',
    'recipe_promoted',
    jsonb_build_object(
      'fr', '🎉 Ta recette a été promue en recette officielle !',
      'en', '🎉 Your recipe has been promoted to an official recipe!',
      'es', '¡🎉 Tu receta ha sido promovida a receta oficial!',
      'de', '🎉 Dein Rezept wurde zu einem offiziellen Rezept befördert!',
      'ja', '🎉 あなたのレシピが公式レシピに昇格されました！'
    ),
    jsonb_build_object(
      'fr', v_recipe.title || ' — bravo et merci pour ta contribution !',
      'en', v_recipe.title || ' — congrats and thanks for your contribution!',
      'es', v_recipe.title || ' — ¡felicidades y gracias por tu contribución!',
      'de', v_recipe.title || ' — Glückwunsch und danke für deinen Beitrag!',
      'ja', v_recipe.title || ' — おめでとうございます、貢献ありがとうございました！'
    ),
    '/recipes/' || v_new_id,
    jsonb_build_object('base_recipe_id', v_new_id, 'custom_recipe_id', p_custom_id)
  );

  -- 9. Log audit (RGPD : trace de l'action admin)
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    auth.uid(),
    'recipe_promoted',
    v_new_id,
    'base_recipe',
    jsonb_build_object('promoted_from_id', p_custom_id, 'original_author_id', v_recipe.user_id)
  );

  RETURN json_build_object(
    'promoted',  true,
    'base_id',   v_new_id,
    'custom_id', p_custom_id,
    'author',    v_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_recipe_to_base(text) TO authenticated;

COMMENT ON FUNCTION public.promote_recipe_to_base(text) IS
  'Promeut une recette communauté approuvée et avec consent en recette de base officielle. SECURITY DEFINER : vérifie admin, copie les champs, crée notif honneur au user, logge dans activity_logs. Renseigne original_author_id/name + promoted_from_id + promoted_at.';

-- ─── Commentaires colonnes

COMMENT ON COLUMN public.base_recipes.original_author_id IS
  'User qui a créé la recette communauté à l''origine. NULL si anonymisé (RGPD : suppression compte ou retrait consent). FK vers profiles ON DELETE SET NULL.';
COMMENT ON COLUMN public.base_recipes.original_author_name IS
  'Snapshot du username au moment de la promotion. À mettre à NULL via RPC anonymize_user (Sprint 8).';
COMMENT ON COLUMN public.base_recipes.promoted_from_id IS
  'ID de la recette communauté d''origine. FK vers custom_recipes ON DELETE SET NULL.';
COMMENT ON COLUMN public.base_recipes.promoted_at IS
  'Date à laquelle la recette a été promue en officielle.';
