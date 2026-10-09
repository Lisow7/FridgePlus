-- ============================================================
-- v0.16.x — Refonte BDD Sprint 5 — Sync triggers base/custom → unified (PR-DB-11)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Pourquoi des triggers cette fois (vs Sprint 4 où on s'en est passé) :
-- Sprint 4 fusionnait des catalogues quasi-statiques (allergens, diets,
-- countries…) modifiés rarement, le risque de drift était négligeable.
-- Sprint 5 fusionne `base_recipes` (admin promote, edit) + `custom_recipes`
-- (user create/edit fréquent). Sans triggers, drift garanti → PR-DB-12
-- (switch reads) afficherait des données obsolètes aux users.
--
-- Stratégie : sync UNI-DIRECTIONNEL `ancien → recipes_unified`.
-- Les writes app continuent sur les anciennes tables (statu quo), le
-- trigger réplique chaque INSERT/UPDATE/DELETE vers `recipes_unified`.
-- Quand PR-DB-12 switche les reads, l'app verra des données fraîches.
--
-- PR-DB-13 (futur) : bascule writes vers `recipes_unified` + DROP triggers
-- + DROP `base_recipes` et `custom_recipes`.
-- ============================================================

BEGIN;

-- ─── 1) Trigger function : sync base_recipes → recipes_unified ───────────────
CREATE OR REPLACE FUNCTION public.sync_base_recipes_to_unified()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.recipes_unified
    WHERE id = OLD.id AND origin = 'official';
    RETURN OLD;
  END IF;

  -- INSERT ou UPDATE : UPSERT vers recipes_unified
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country, diet, ingredients,
    description, steps, allergens, image_url, status,
    original_author_id, original_author_name, promoted_from_id, promoted_at,
    created_at, updated_at
  ) VALUES (
    NEW.id, 'official', NEW.name, NEW.emoji, NEW.time_min, NEW.prep_time_min, NEW.cook_time_min,
    NEW.difficulty, NEW.type, NEW.servings, NEW.country, NEW.diet, NEW.ingredients,
    NEW.description, NEW.steps, NEW.allergens, NEW.image_url, NEW.status,
    NEW.original_author_id, NEW.original_author_name, NEW.promoted_from_id, NEW.promoted_at,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name                  = EXCLUDED.name,
    emoji                 = EXCLUDED.emoji,
    time_min              = EXCLUDED.time_min,
    prep_time_min         = EXCLUDED.prep_time_min,
    cook_time_min         = EXCLUDED.cook_time_min,
    difficulty            = EXCLUDED.difficulty,
    type                  = EXCLUDED.type,
    servings              = EXCLUDED.servings,
    country               = EXCLUDED.country,
    diet                  = EXCLUDED.diet,
    ingredients           = EXCLUDED.ingredients,
    description           = EXCLUDED.description,
    steps                 = EXCLUDED.steps,
    allergens             = EXCLUDED.allergens,
    image_url             = EXCLUDED.image_url,
    status                = EXCLUDED.status,
    original_author_id    = EXCLUDED.original_author_id,
    original_author_name  = EXCLUDED.original_author_name,
    promoted_from_id      = EXCLUDED.promoted_from_id,
    promoted_at           = EXCLUDED.promoted_at,
    updated_at            = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_base_recipes_to_unified() FROM anon;

-- ─── 2) Trigger function : sync custom_recipes → recipes_unified ─────────────
-- Plus complexe : extrait jsonb `data` lors de chaque write
CREATE OR REPLACE FUNCTION public.sync_custom_recipes_to_unified()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.recipes_unified
    WHERE id = OLD.id AND origin = 'community';
    RETURN OLD;
  END IF;

  -- INSERT ou UPDATE : UPSERT vers recipes_unified (extract data jsonb)
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, difficulty, type, servings, country,
    diet, ingredients, steps, allergens, status,
    user_id, is_public, moderation_status, admin_modified, consent_to_promote, deleted_at,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    'community',
    CASE
      WHEN jsonb_typeof(NEW.data->'name') = 'object' THEN NEW.data->'name'
      WHEN NEW.data->>'name' IS NOT NULL THEN jsonb_build_object('fr', NEW.data->>'name')
      ELSE jsonb_build_object('fr', NEW.title)
    END,
    COALESCE(NEW.data->>'emoji', '🍳'),
    COALESCE(NULLIF(regexp_replace(COALESCE(NEW.data->>'time', '30'), '[^0-9]', '', 'g'), '')::integer, 30),
    COALESCE(NEW.data->>'difficulty', 'medium'),
    COALESCE(NEW.data->>'type', 'main'),
    COALESCE(NULLIF(NEW.data->>'servings', '')::integer, 2),
    NEW.data->>'country',
    COALESCE(NEW.data->'diet', '[]'::jsonb),
    COALESCE(NEW.data->'ingredients', '[]'::jsonb),
    COALESCE(NEW.data->'steps', '{}'::jsonb),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.data->'allergens')), '{}'::text[]),
    CASE WHEN NEW.is_public AND NEW.moderation_status = 'approved' THEN 'published' ELSE 'draft' END,
    NEW.user_id, NEW.is_public, NEW.moderation_status,
    COALESCE(NEW.admin_modified, false), NEW.consent_to_promote, NEW.deleted_at,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    emoji = EXCLUDED.emoji,
    time_min = EXCLUDED.time_min,
    difficulty = EXCLUDED.difficulty,
    type = EXCLUDED.type,
    servings = EXCLUDED.servings,
    country = EXCLUDED.country,
    diet = EXCLUDED.diet,
    ingredients = EXCLUDED.ingredients,
    steps = EXCLUDED.steps,
    allergens = EXCLUDED.allergens,
    status = EXCLUDED.status,
    user_id = EXCLUDED.user_id,
    is_public = EXCLUDED.is_public,
    moderation_status = EXCLUDED.moderation_status,
    admin_modified = EXCLUDED.admin_modified,
    consent_to_promote = EXCLUDED.consent_to_promote,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_custom_recipes_to_unified() FROM anon;

-- ─── 3) Attach triggers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS base_recipes_sync_unified ON public.base_recipes;
CREATE TRIGGER base_recipes_sync_unified
  AFTER INSERT OR UPDATE OR DELETE ON public.base_recipes
  FOR EACH ROW EXECUTE FUNCTION public.sync_base_recipes_to_unified();

DROP TRIGGER IF EXISTS custom_recipes_sync_unified ON public.custom_recipes;
CREATE TRIGGER custom_recipes_sync_unified
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_recipes
  FOR EACH ROW EXECUTE FUNCTION public.sync_custom_recipes_to_unified();

COMMIT;
