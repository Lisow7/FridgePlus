-- Promotion d'une recette communautaire en recette officielle (base_recipes)
-- ----------------------------------------------------------------------
-- Permet à un admin de "promouvoir" une recette créée par un utilisateur
-- en recette de base du catalogue Fridge+, avec son nom comme crédit.
--
-- Conditions strictes :
--   1. La recette doit être en custom_recipes, status approved, deleted_at null
--   2. L'auteur doit avoir explicitement consenti (consent_to_promote = true)
--   3. L'admin appelant doit être admin (is_admin())
--   4. Pas déjà promue (pas de base_recipes avec promoted_from_id = custom.id)
--
-- Action :
--   1. Crée une row dans base_recipes avec :
--      • id = nouvel id text (slug + suffix random)
--      • title = recipe.title
--      • emoji, time_min, ingredients, etc. = copiés
--      • status = 'published'
--      • original_author_id = custom_recipes.user_id
--      • original_author_name = snapshot du username au moment de la promotion
--      • promoted_from_id = custom_recipes.id
--      • promoted_at = now()
--   2. Crée une notif `recipe_promoted` au user (type honneur 🎉)
--   3. Logge dans activity_logs (action 'recipe_promoted')
--   4. NE supprime PAS la custom_recipes (préservation de l'original)
--
-- Idempotent (re-promote = no-op si déjà promue).

-- ─── Schéma : colonnes ajoutées sur base_recipes ────────────────────────────

ALTER TABLE public.base_recipes
  ADD COLUMN IF NOT EXISTS original_author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_author_name text,
  ADD COLUMN IF NOT EXISTS promoted_from_id     uuid REFERENCES public.custom_recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at          timestamptz;

CREATE INDEX IF NOT EXISTS idx_base_recipes_promoted_from
  ON public.base_recipes (promoted_from_id) WHERE promoted_from_id IS NOT NULL;

COMMENT ON COLUMN public.base_recipes.original_author_id IS
  'User qui a créé la recette communauté à l''origine. NULL si anonymisé (RGPD : suppression compte ou retrait consent).';
COMMENT ON COLUMN public.base_recipes.original_author_name IS
  'Snapshot du username au moment de la promotion. Mis à NULL en cas d''anonymisation.';

-- ─── Fonction RPC promote_recipe_to_base ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.promote_recipe_to_base(p_custom_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipe       record;
  v_username     text;
  v_new_id       text;
  v_existing     uuid;
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

  -- 3. Vérifier les conditions de promotion
  IF v_recipe.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'Recipe must be approved before promotion (current: %)', v_recipe.moderation_status USING ERRCODE = 'P0003';
  END IF;

  IF v_recipe.consent_to_promote IS NOT TRUE THEN
    RAISE EXCEPTION 'Author has not consented to promotion (consent_to_promote = false)' USING ERRCODE = 'P0004';
  END IF;

  -- 4. Vérifier qu'elle n'est pas déjà promue
  SELECT id INTO v_existing
  FROM public.base_recipes
  WHERE promoted_from_id = p_custom_id;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('promoted', false, 'reason', 'already_promoted', 'base_id', v_existing);
  END IF;

  -- 5. Générer un id text pour base_recipes (slug du titre + suffix random)
  -- Note : base_recipes utilise text id (pas uuid) — alignement legacy.
  v_new_id := lower(regexp_replace(coalesce(v_recipe.title, 'recipe'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substring(md5(random()::text), 1, 6);

  -- 6. Snapshot du username pour le crédit (peut être anonymisé plus tard)
  SELECT username INTO v_username
  FROM public.profiles
  WHERE id = v_recipe.user_id;

  -- 7. Créer la base_recipe à partir des champs JSONB de custom_recipes.data
  -- On extrait emoji, time_min, ingredients, steps, etc. depuis le JSONB.
  INSERT INTO public.base_recipes (
    id, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country, diet, allergens,
    ingredients, description, steps, image_url, status,
    original_author_id, original_author_name,
    promoted_from_id, promoted_at
  ) VALUES (
    v_new_id,
    -- name = jsonb {fr, en, es, de, ja} → on prend recipe.name si jsonb, sinon objet vide avec fr=title
    CASE
      WHEN v_recipe.data ? 'name' AND jsonb_typeof(v_recipe.data->'name') = 'object'
        THEN v_recipe.data->'name'
      ELSE jsonb_build_object('fr', v_recipe.title, 'en', v_recipe.title, 'es', v_recipe.title, 'de', v_recipe.title, 'ja', v_recipe.title)
    END,
    coalesce(v_recipe.data->>'emoji', '🍽️'),
    nullif(v_recipe.data->>'time_min', '')::int,
    nullif(v_recipe.data->>'prep_time_min', '')::int,
    nullif(v_recipe.data->>'cook_time_min', '')::int,
    coalesce(v_recipe.data->>'difficulty', 'easy'),
    coalesce(v_recipe.data->>'type', 'main'),
    coalesce(nullif(v_recipe.data->>'servings', '')::int, 2),
    v_recipe.data->>'country',
    coalesce(
      array(SELECT jsonb_array_elements_text(v_recipe.data->'diet')),
      ARRAY[]::text[]
    ),
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

  -- 9. Log audit
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

GRANT EXECUTE ON FUNCTION public.promote_recipe_to_base(uuid) TO authenticated;

COMMENT ON FUNCTION public.promote_recipe_to_base(uuid) IS
  'Promeut une recette communauté approuvée et avec consent en recette de base officielle. SECURITY DEFINER : vérifie admin, copie les champs, crée notif honneur au user, logge dans activity_logs.';
