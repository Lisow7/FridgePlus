-- 20260615 — Correctif architecture vue/triggers custom_recipes.
-- ----------------------------------------------------------------------
-- `custom_recipes` est une VUE sur `recipes_unified` (refonte BDD) avec des
-- triggers INSTEAD OF qui décomposent les écritures. Le jeu de champs était
-- figé, donc deux features récentes étaient cassées :
--   • R-03 : le code insère les colonnes published_consent_at/version dans la
--     vue, qui ne les exposait pas → publication de recette en ERREUR.
--   • R-04 : ai_moderation_status voyage dans `data`, mais le trigger ne
--     l'extrayait pas et recipes_unified n'avait pas la colonne → donnée
--     PERDUE silencieusement (badge admin jamais affiché).
--
-- Correctif (modèle consent_to_promote, qui round-trip correctement) :
--   1. colonnes réelles sur recipes_unified ;
--   2. vue : published_consent_* en colonnes directes + ai_moderation_status
--      réinjecté dans le jsonb `data` (lecture admin via custom_recipes.data) ;
--   3. triggers INSERT + UPDATE : propagation des 3 champs. À l'UPDATE on
--      utilise COALESCE pour NE JAMAIS effacer la preuve de consentement lors
--      d'un update partiel (ex. approve/reject admin qui ne renvoie pas tout).
--
-- Supersède 20260613_recipe_publish_consent.sql (qui faisait ALTER TABLE sur
-- une vue = invalide). Aucun changement de code applicatif requis. Idempotent.

-- ── 1. Colonnes réelles ─────────────────────────────────────────────────────
ALTER TABLE public.recipes_unified
  ADD COLUMN IF NOT EXISTS published_consent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS published_consent_version text,
  ADD COLUMN IF NOT EXISTS ai_moderation_status      text;

COMMENT ON COLUMN public.recipes_unified.published_consent_at IS
  'R-03 — horodatage du consentement explicite à publier en communauté. NULL = privée/legacy. Preuve RGPD Art.7.';
COMMENT ON COLUMN public.recipes_unified.published_consent_version IS
  'R-03 — version des conditions acceptées au consentement (cf. LEGAL_CONSENT_VERSION).';
COMMENT ON COLUMN public.recipes_unified.ai_moderation_status IS
  'R-04 — statut de la modération IA OpenAI (passed/error/skipped). Lu par la file admin pour prioriser la review humaine.';

-- ── 2. Vue custom_recipes ───────────────────────────────────────────────────
-- (CREATE OR REPLACE VIEW : on garde l'ordre des colonnes existantes et on
--  ajoute les nouvelles à la fin ; la colonne `data` reste jsonb.)
CREATE OR REPLACE VIEW public.custom_recipes AS
 SELECT id,
    user_id,
    title,
    jsonb_strip_nulls(jsonb_build_object(
      'name', name, 'emoji', emoji, 'time', time_min::text, 'time_min', time_min,
      'prep_time_min', prep_time_min, 'cook_time_min', cook_time_min,
      'difficulty', difficulty, 'type', type, 'servings', servings, 'country', country,
      'diet', diet, 'ingredients', ingredients, 'description', description, 'steps', steps,
      'allergens', to_jsonb(allergens), 'image_url', image_url,
      'ai_moderation_status', ai_moderation_status
    )) AS data,
    is_public,
    deleted_at,
    created_at,
    updated_at,
    moderation_status,
    admin_modified,
    consent_to_promote,
    moderation_reason,
    published_consent_at,
    published_consent_version
   FROM recipes_unified
  WHERE origin = 'community'::text;

-- ── 3. Trigger INSERT ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.custom_recipes_iof_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country,
    diet, ingredients, description, steps, allergens, image_url,
    status, user_id, title,
    is_public, moderation_status, admin_modified, consent_to_promote,
    moderation_reason, deleted_at, created_at, updated_at,
    published_consent_at, published_consent_version, ai_moderation_status
  ) VALUES (
    NEW.id, 'community',
    CASE
      WHEN jsonb_typeof(NEW.data->'name') = 'object' THEN NEW.data->'name'
      WHEN NEW.data->>'name' IS NOT NULL THEN jsonb_build_object('fr', NEW.data->>'name')
      ELSE jsonb_build_object('fr', NEW.title)
    END,
    COALESCE(NEW.data->>'emoji', '🍳'),
    COALESCE(NULLIF(regexp_replace(COALESCE(NEW.data->>'time_min', NEW.data->>'time', '30'), '[^0-9]', '', 'g'), '')::integer, 30),
    NULLIF(NEW.data->>'prep_time_min', '')::integer,
    NULLIF(NEW.data->>'cook_time_min', '')::integer,
    COALESCE(NEW.data->>'difficulty', 'medium'),
    COALESCE(NEW.data->>'type', 'main'),
    COALESCE(NULLIF(NEW.data->>'servings', '')::integer, 2),
    NEW.data->>'country',
    COALESCE(NEW.data->'diet', '[]'::jsonb),
    COALESCE(NEW.data->'ingredients', '[]'::jsonb),
    COALESCE(NEW.data->'description', '{}'::jsonb),
    COALESCE(NEW.data->'steps', '{}'::jsonb),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.data->'allergens')), '{}'::text[]),
    NEW.data->>'image_url',
    CASE WHEN NEW.is_public AND NEW.moderation_status = 'approved' THEN 'published' ELSE 'draft' END,
    NEW.user_id, NEW.title,
    COALESCE(NEW.is_public, false),
    COALESCE(NEW.moderation_status, 'private'),
    COALESCE(NEW.admin_modified, false),
    COALESCE(NEW.consent_to_promote, false),
    NEW.moderation_reason, NEW.deleted_at,
    COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now()),
    NEW.published_consent_at, NEW.published_consent_version, NEW.data->>'ai_moderation_status'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, emoji = EXCLUDED.emoji, time_min = EXCLUDED.time_min,
    prep_time_min = EXCLUDED.prep_time_min, cook_time_min = EXCLUDED.cook_time_min,
    difficulty = EXCLUDED.difficulty, type = EXCLUDED.type,
    servings = EXCLUDED.servings, country = EXCLUDED.country,
    diet = EXCLUDED.diet, ingredients = EXCLUDED.ingredients,
    description = EXCLUDED.description, steps = EXCLUDED.steps,
    allergens = EXCLUDED.allergens, image_url = EXCLUDED.image_url,
    status = EXCLUDED.status, title = EXCLUDED.title, is_public = EXCLUDED.is_public,
    moderation_status = EXCLUDED.moderation_status, admin_modified = EXCLUDED.admin_modified,
    consent_to_promote = EXCLUDED.consent_to_promote,
    moderation_reason = EXCLUDED.moderation_reason,
    deleted_at = EXCLUDED.deleted_at, updated_at = EXCLUDED.updated_at,
    published_consent_at = EXCLUDED.published_consent_at,
    published_consent_version = EXCLUDED.published_consent_version,
    ai_moderation_status = EXCLUDED.ai_moderation_status;
  RETURN NEW;
END;
$function$;

-- ── 4. Trigger UPDATE (COALESCE = jamais effacer la preuve) ─────────────────
CREATE OR REPLACE FUNCTION public.custom_recipes_iof_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_new_data jsonb;
BEGIN
  v_new_data := NEW.data;
  UPDATE public.recipes_unified SET
    title = NEW.title,
    name = CASE
      WHEN v_new_data IS DISTINCT FROM OLD.data AND jsonb_typeof(v_new_data->'name') = 'object' THEN v_new_data->'name'
      WHEN v_new_data IS DISTINCT FROM OLD.data AND v_new_data->>'name' IS NOT NULL THEN jsonb_build_object('fr', v_new_data->>'name')
      ELSE name
    END,
    emoji = COALESCE(v_new_data->>'emoji', emoji),
    time_min = COALESCE(NULLIF(regexp_replace(COALESCE(v_new_data->>'time_min', v_new_data->>'time'), '[^0-9]', '', 'g'), '')::integer, time_min),
    prep_time_min = COALESCE(NULLIF(v_new_data->>'prep_time_min', '')::integer, prep_time_min),
    cook_time_min = COALESCE(NULLIF(v_new_data->>'cook_time_min', '')::integer, cook_time_min),
    difficulty = COALESCE(v_new_data->>'difficulty', difficulty),
    type = COALESCE(v_new_data->>'type', type),
    servings = COALESCE(NULLIF(v_new_data->>'servings', '')::integer, servings),
    country = COALESCE(v_new_data->>'country', country),
    diet = COALESCE(v_new_data->'diet', diet),
    ingredients = COALESCE(v_new_data->'ingredients', ingredients),
    description = COALESCE(v_new_data->'description', description),
    steps = COALESCE(v_new_data->'steps', steps),
    allergens = CASE
      WHEN v_new_data->'allergens' IS NOT NULL
      THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_new_data->'allergens')), '{}'::text[])
      ELSE allergens
    END,
    image_url = COALESCE(v_new_data->>'image_url', image_url),
    is_public = COALESCE(NEW.is_public, is_public),
    moderation_status = COALESCE(NEW.moderation_status, moderation_status),
    admin_modified = COALESCE(NEW.admin_modified, admin_modified),
    consent_to_promote = COALESCE(NEW.consent_to_promote, consent_to_promote),
    moderation_reason = NEW.moderation_reason,
    deleted_at = NEW.deleted_at,
    published_consent_at = COALESCE(NEW.published_consent_at, published_consent_at),
    published_consent_version = COALESCE(NEW.published_consent_version, published_consent_version),
    ai_moderation_status = COALESCE(v_new_data->>'ai_moderation_status', ai_moderation_status),
    status = CASE WHEN COALESCE(NEW.is_public, is_public) AND COALESCE(NEW.moderation_status, moderation_status) = 'approved' THEN 'published' ELSE 'draft' END,
    updated_at = now()
  WHERE id = OLD.id AND origin = 'community';
  RETURN NEW;
END;
$function$;
