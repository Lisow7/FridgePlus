-- ============================================================
-- v0.16.x — Refonte BDD Sprint 5d — Vues compat base_recipes/custom_recipes
-- ------------------------------------------------------------
-- Stratégie Strangler Fig validée empiriquement (3 tests SQL, cf. PR description) :
--   - base_recipes / custom_recipes deviennent des VIEWS sur recipes_unified
--   - INSTEAD OF INSERT/UPDATE/DELETE triggers pour rediriger les écritures
--   - 2 changements JS uniquement (.upsert → .insert dans recipes.js + migration.js)
--
-- Rollback safety : les anciennes tables sont RENAMED en _legacy (pas DROP).
-- DROP final dans Sprint 5e après 1-2 jours de soak window.
--
-- Pré-vérifs (faites avant écriture) :
--   - parity base_recipes (101) = recipes_unified WHERE origin='official' (101) ✓
--   - parity custom_recipes (7) = recipes_unified WHERE origin='community' (7) ✓
--   - 3 tests SQL : auto-updatable view OK, INSTEAD OF + INSERT OK
-- ============================================================

BEGIN;

-- ─── 1) Étendre recipes_unified avec title + moderation_reason ──────────────
-- Ces colonnes existaient sur custom_recipes mais pas sur recipes_unified.
-- Indispensables pour que les views projettent les mêmes colonnes que les
-- tables legacy et que le code JS lit pareil sans changement.

ALTER TABLE public.recipes_unified
  ADD COLUMN IF NOT EXISTS title             text,
  ADD COLUMN IF NOT EXISTS moderation_reason text;

UPDATE public.recipes_unified ru
SET title = cr.title, moderation_reason = cr.moderation_reason
FROM public.custom_recipes cr
WHERE ru.id = cr.id AND ru.origin = 'community';

-- ─── 2) RLS recipes_unified : ajouter community own (INSERT/UPDATE) ────────
-- Avant cette PR, recipes_unified n'avait que les policies admin write.
-- Les writes user passaient par custom_recipes → recipes_unified via trigger.
-- Maintenant les writes vont directement via INSTEAD OF → recipes_unified,
-- donc les policies user doivent être sur recipes_unified.
-- Pas de DELETE policy : la suppression user passe par delete_custom_recipe_rgpd RPC.

CREATE POLICY recipes_unified_insert_community_own ON public.recipes_unified
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    origin = 'community'
    AND user_id = (SELECT auth.uid())
  );

CREATE POLICY recipes_unified_update_community_own ON public.recipes_unified
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    origin = 'community'
    AND user_id = (SELECT auth.uid())
    AND deleted_at IS NULL
  )
  WITH CHECK (
    origin = 'community'
    AND user_id = (SELECT auth.uid())
  );

-- ─── 3) Drop les sync triggers (legacy → unified) ──────────────────────────
-- Devenus obsolètes : les writes passent par les views et vont directement
-- sur recipes_unified. Plus rien n'écrit sur les tables legacy.

DROP TRIGGER IF EXISTS base_recipes_sync_unified         ON public.base_recipes;
DROP TRIGGER IF EXISTS custom_recipes_sync_unified       ON public.custom_recipes;
DROP TRIGGER IF EXISTS prevent_edit_approved_custom_recipe_trigger ON public.custom_recipes;
DROP TRIGGER IF EXISTS trg_notify_recipe_status_changed  ON public.custom_recipes;
DROP TRIGGER IF EXISTS trg_notify_recipe_submitted       ON public.custom_recipes;
DROP TRIGGER IF EXISTS base_recipes_updated_at           ON public.base_recipes;
DROP TRIGGER IF EXISTS custom_recipes_updated_at         ON public.custom_recipes;

DROP FUNCTION IF EXISTS public.sync_base_recipes_to_unified()   CASCADE;
DROP FUNCTION IF EXISTS public.sync_custom_recipes_to_unified() CASCADE;

-- ─── 4) Drop FK base_recipes.promoted_from_id (devient self-ref unified) ────

ALTER TABLE public.base_recipes
  DROP CONSTRAINT IF EXISTS base_recipes_promoted_from_id_fkey;

-- ─── 5) RENAME tables legacy (rollback safety pendant soak window) ─────────

ALTER TABLE public.base_recipes   RENAME TO base_recipes_legacy;
ALTER TABLE public.custom_recipes RENAME TO custom_recipes_legacy;

-- ─── 6) Recreate business triggers sur recipes_unified WHEN origin='community'

-- 6a) prevent_edit_approved : empêche un user de modifier une recette
-- communauté déjà approuvée (admin bypass via is_admin()).
CREATE OR REPLACE FUNCTION public.prevent_edit_approved_recipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  -- Ne s'applique qu'aux recettes community déjà approuvées
  IF OLD.origin <> 'community' OR OLD.moderation_status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Admin bypass
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Seuls deleted_at, restored_at, updated_at sont modifiables.
  -- Tout autre changement bloqué pour préserver le contenu validé.
  IF NEW.title              IS DISTINCT FROM OLD.title
     OR NEW.name            IS DISTINCT FROM OLD.name
     OR NEW.emoji           IS DISTINCT FROM OLD.emoji
     OR NEW.time_min        IS DISTINCT FROM OLD.time_min
     OR NEW.prep_time_min   IS DISTINCT FROM OLD.prep_time_min
     OR NEW.cook_time_min   IS DISTINCT FROM OLD.cook_time_min
     OR NEW.difficulty      IS DISTINCT FROM OLD.difficulty
     OR NEW.type            IS DISTINCT FROM OLD.type
     OR NEW.servings        IS DISTINCT FROM OLD.servings
     OR NEW.country         IS DISTINCT FROM OLD.country
     OR NEW.diet            IS DISTINCT FROM OLD.diet
     OR NEW.ingredients     IS DISTINCT FROM OLD.ingredients
     OR NEW.description     IS DISTINCT FROM OLD.description
     OR NEW.steps           IS DISTINCT FROM OLD.steps
     OR NEW.allergens       IS DISTINCT FROM OLD.allergens
     OR NEW.image_url       IS DISTINCT FROM OLD.image_url
     OR NEW.is_public          IS DISTINCT FROM OLD.is_public
     OR NEW.moderation_status  IS DISTINCT FROM OLD.moderation_status
     OR NEW.consent_to_promote IS DISTINCT FROM OLD.consent_to_promote
  THEN
    RAISE EXCEPTION 'Cannot edit an approved recipe. Only admins can modify approved community recipes.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_edit_approved_recipe_trigger
  BEFORE UPDATE ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edit_approved_recipe();

-- Drop l'ancienne fonction custom_recipes-spécifique
DROP FUNCTION IF EXISTS public.prevent_edit_approved_custom_recipe() CASCADE;

-- 6b) notify_recipe_submitted : notif admin quand une recette communauté
-- passe en pending (publication demandée).
CREATE OR REPLACE FUNCTION public.notify_recipe_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_title jsonb;
  v_recipe_title text;
BEGIN
  -- Ne déclencher que pour les inserts community pending
  IF NEW.origin <> 'community' OR NEW.moderation_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  v_recipe_title := COALESCE(NEW.title, NEW.name->>'fr', NEW.name->>'en', NEW.id);

  v_title := jsonb_build_object(
    'fr', 'Nouvelle recette à modérer',
    'en', 'New recipe to moderate',
    'es', 'Nueva receta por moderar',
    'de', 'Neues Rezept zu prüfen',
    'ja', 'モデレーション待ちの新しいレシピ'
  );

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    NULL,
    'admin',
    'recipe_pending',
    v_title,
    jsonb_build_object('fr', v_recipe_title, 'en', v_recipe_title, 'es', v_recipe_title, 'de', v_recipe_title, 'ja', v_recipe_title),
    '/admin/recipes/' || NEW.id::text,
    jsonb_build_object('recipe_id', NEW.id, 'user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_recipe_submitted
  AFTER INSERT ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.notify_recipe_submitted();

-- 6c) notify_recipe_status_changed : notif user au moderation status change
CREATE OR REPLACE FUNCTION public.notify_recipe_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_title  jsonb;
  v_body   jsonb;
  v_type   text;
  v_reason text;
  v_recipe_title text;
BEGIN
  -- Ne déclencher que pour les recettes community avec status changé
  IF NEW.origin <> 'community' THEN
    RETURN NEW;
  END IF;

  IF NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(NEW.moderation_reason, '')), '');
  v_recipe_title := COALESCE(NEW.title, NEW.name->>'fr', NEW.name->>'en', NEW.id);

  IF NEW.moderation_status = 'approved' THEN
    v_type  := 'recipe_approved';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été approuvée 🎉',
      'en', 'Your recipe has been approved 🎉',
      'es', '¡Tu receta ha sido aprobada 🎉!',
      'de', 'Dein Rezept wurde genehmigt 🎉',
      'ja', 'レシピが承認されました 🎉'
    );
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', v_recipe_title || ' — ' || v_reason,
        'en', v_recipe_title || ' — ' || v_reason,
        'es', v_recipe_title || ' — ' || v_reason,
        'de', v_recipe_title || ' — ' || v_reason,
        'ja', v_recipe_title || ' — ' || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', v_recipe_title, 'en', v_recipe_title,
        'es', v_recipe_title, 'de', v_recipe_title, 'ja', v_recipe_title
      );
    END IF;

  ELSIF NEW.moderation_status = 'rejected' THEN
    v_type  := 'recipe_rejected';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été refusée',
      'en', 'Your recipe was declined',
      'es', 'Tu receta fue rechazada',
      'de', 'Dein Rezept wurde abgelehnt',
      'ja', 'レシピが却下されました'
    );
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', v_recipe_title || ' — Motif : ' || v_reason,
        'en', v_recipe_title || ' — Reason: '  || v_reason,
        'es', v_recipe_title || ' — Motivo: '  || v_reason,
        'de', v_recipe_title || ' — Grund: '   || v_reason,
        'ja', v_recipe_title || ' — 理由：'     || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', v_recipe_title, 'en', v_recipe_title,
        'es', v_recipe_title, 'de', v_recipe_title, 'ja', v_recipe_title
      );
    END IF;

  ELSIF NEW.moderation_status = 'pending' AND OLD.moderation_status != 'pending' THEN
    v_type  := 'recipe_pending_correction';
    v_title := jsonb_build_object(
      'fr', 'Des corrections sont demandées pour ta recette',
      'en', 'Corrections are requested for your recipe',
      'es', 'Se solicitan correcciones para tu receta',
      'de', 'Korrekturen für dein Rezept wurden angefordert',
      'ja', 'レシピに修正が必要です'
    );
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', v_recipe_title || ' — ' || v_reason,
        'en', v_recipe_title || ' — ' || v_reason,
        'es', v_recipe_title || ' — ' || v_reason,
        'de', v_recipe_title || ' — ' || v_reason,
        'ja', v_recipe_title || ' — ' || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', v_recipe_title, 'en', v_recipe_title,
        'es', v_recipe_title, 'de', v_recipe_title, 'ja', v_recipe_title
      );
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'user',
    v_type,
    v_title,
    v_body,
    '/recipes/' || NEW.id::text,
    jsonb_build_object('recipe_id', NEW.id)
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_notify_recipe_status_changed
  AFTER UPDATE ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.notify_recipe_status_changed();

-- ─── 7) VIEW base_recipes (security_invoker, INSTEAD OF triggers) ───────────
-- security_invoker=true → RLS recipes_unified s'applique avec les permissions
-- du user appelant (pattern Supabase 2026, requis pour Postgres 15+).
-- INSTEAD OF triggers : pas auto-updatable (on veut contrôler explicitement
-- origin='official') + .insert() côté JS doit upsert via ON CONFLICT interne.

CREATE VIEW public.base_recipes
  WITH (security_invoker = true)
AS
SELECT
  id, name, emoji, time_min, prep_time_min, cook_time_min,
  difficulty, type, servings, country, diet, ingredients,
  description, steps, allergens, image_url, status,
  original_author_id, original_author_name, promoted_from_id, promoted_at,
  created_at, updated_at
FROM public.recipes_unified
WHERE origin = 'official';

COMMENT ON VIEW public.base_recipes IS
  'Refonte Sprint 5d : view sur recipes_unified WHERE origin=official. Données réelles dans recipes_unified. INSTEAD OF triggers gèrent les writes (.insert() JS = upsert via trigger).';

-- INSTEAD OF INSERT : upsert vers recipes_unified avec origin='official'
CREATE OR REPLACE FUNCTION public.base_recipes_iof_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country, diet, ingredients,
    description, steps, allergens, image_url, status,
    original_author_id, original_author_name, promoted_from_id, promoted_at,
    created_at, updated_at
  ) VALUES (
    NEW.id, 'official',
    COALESCE(NEW.name, '{}'::jsonb),
    COALESCE(NEW.emoji, '🍳'),
    COALESCE(NEW.time_min, 30),
    NEW.prep_time_min, NEW.cook_time_min,
    COALESCE(NEW.difficulty, 'medium'),
    COALESCE(NEW.type, 'main'),
    COALESCE(NEW.servings, 2),
    NEW.country,
    COALESCE(NEW.diet, '[]'::jsonb),
    COALESCE(NEW.ingredients, '[]'::jsonb),
    COALESCE(NEW.description, '{}'::jsonb),
    COALESCE(NEW.steps, '{}'::jsonb),
    COALESCE(NEW.allergens, '{}'::text[]),
    NEW.image_url,
    COALESCE(NEW.status, 'published'),
    NEW.original_author_id, NEW.original_author_name,
    NEW.promoted_from_id, NEW.promoted_at,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, emoji = EXCLUDED.emoji,
    time_min = EXCLUDED.time_min,
    prep_time_min = EXCLUDED.prep_time_min, cook_time_min = EXCLUDED.cook_time_min,
    difficulty = EXCLUDED.difficulty, type = EXCLUDED.type,
    servings = EXCLUDED.servings, country = EXCLUDED.country,
    diet = EXCLUDED.diet, ingredients = EXCLUDED.ingredients,
    description = EXCLUDED.description, steps = EXCLUDED.steps,
    allergens = EXCLUDED.allergens, image_url = EXCLUDED.image_url,
    status = EXCLUDED.status,
    original_author_id = EXCLUDED.original_author_id,
    original_author_name = EXCLUDED.original_author_name,
    promoted_from_id = EXCLUDED.promoted_from_id,
    promoted_at = EXCLUDED.promoted_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER base_recipes_iof_insert_trigger
  INSTEAD OF INSERT ON public.base_recipes
  FOR EACH ROW EXECUTE FUNCTION public.base_recipes_iof_insert();

-- INSTEAD OF UPDATE : update recipes_unified WHERE id + origin='official'
CREATE OR REPLACE FUNCTION public.base_recipes_iof_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  UPDATE public.recipes_unified SET
    name = NEW.name, emoji = NEW.emoji,
    time_min = NEW.time_min,
    prep_time_min = NEW.prep_time_min, cook_time_min = NEW.cook_time_min,
    difficulty = NEW.difficulty, type = NEW.type, servings = NEW.servings,
    country = NEW.country, diet = NEW.diet, ingredients = NEW.ingredients,
    description = NEW.description, steps = NEW.steps,
    allergens = NEW.allergens, image_url = NEW.image_url, status = NEW.status,
    original_author_id = NEW.original_author_id,
    original_author_name = NEW.original_author_name,
    promoted_from_id = NEW.promoted_from_id,
    promoted_at = NEW.promoted_at,
    updated_at = now()
  WHERE id = OLD.id AND origin = 'official';
  RETURN NEW;
END;
$function$;

CREATE TRIGGER base_recipes_iof_update_trigger
  INSTEAD OF UPDATE ON public.base_recipes
  FOR EACH ROW EXECUTE FUNCTION public.base_recipes_iof_update();

-- INSTEAD OF DELETE : delete recipes_unified WHERE id + origin='official'
CREATE OR REPLACE FUNCTION public.base_recipes_iof_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  DELETE FROM public.recipes_unified
  WHERE id = OLD.id AND origin = 'official';
  RETURN OLD;
END;
$function$;

CREATE TRIGGER base_recipes_iof_delete_trigger
  INSTEAD OF DELETE ON public.base_recipes
  FOR EACH ROW EXECUTE FUNCTION public.base_recipes_iof_delete();

-- ─── 8) VIEW custom_recipes (security_invoker, INSTEAD OF triggers) ─────────
-- Reconstruit la colonne `data` jsonb depuis les colonnes structurées de
-- recipes_unified pour préserver le shape attendu par les consumers
-- (recipes.js, admin.js, community.js, etc.).

CREATE VIEW public.custom_recipes
  WITH (security_invoker = true)
AS
SELECT
  id, user_id, title,
  -- Reconstruction du jsonb data depuis colonnes structurées.
  -- Inverse du sync trigger custom→unified original (cf. PR-DB-11).
  jsonb_strip_nulls(jsonb_build_object(
    'name',           name,
    'emoji',          emoji,
    'time',           time_min::text,
    'time_min',       time_min,
    'prep_time_min',  prep_time_min,
    'cook_time_min',  cook_time_min,
    'difficulty',     difficulty,
    'type',           type,
    'servings',       servings,
    'country',        country,
    'diet',           diet,
    'ingredients',    ingredients,
    'description',    description,
    'steps',          steps,
    'allergens',      to_jsonb(allergens),
    'image_url',      image_url
  )) AS data,
  is_public, deleted_at, created_at, updated_at,
  moderation_status, admin_modified, consent_to_promote, moderation_reason
FROM public.recipes_unified
WHERE origin = 'community';

COMMENT ON VIEW public.custom_recipes IS
  'Refonte Sprint 5d : view sur recipes_unified WHERE origin=community. Reconstruit data jsonb depuis colonnes structurées. INSTEAD OF triggers extraient data→colonnes au write.';

-- INSTEAD OF INSERT : extrait NEW.data jsonb → colonnes structurées + upsert
CREATE OR REPLACE FUNCTION public.custom_recipes_iof_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country,
    diet, ingredients, description, steps, allergens, image_url,
    status,
    user_id, title,
    is_public, moderation_status, admin_modified, consent_to_promote,
    moderation_reason, deleted_at,
    created_at, updated_at
  ) VALUES (
    NEW.id, 'community',
    -- name : si data->'name' est jsonb (5 langues) garder, sinon wrap title
    CASE
      WHEN jsonb_typeof(NEW.data->'name') = 'object' THEN NEW.data->'name'
      WHEN NEW.data->>'name' IS NOT NULL THEN jsonb_build_object('fr', NEW.data->>'name')
      ELSE jsonb_build_object('fr', NEW.title)
    END,
    COALESCE(NEW.data->>'emoji', '🍳'),
    COALESCE(
      NULLIF(regexp_replace(COALESCE(NEW.data->>'time_min', NEW.data->>'time', '30'), '[^0-9]', '', 'g'), '')::integer,
      30
    ),
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
    NEW.moderation_reason,
    NEW.deleted_at,
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, emoji = EXCLUDED.emoji,
    time_min = EXCLUDED.time_min,
    prep_time_min = EXCLUDED.prep_time_min, cook_time_min = EXCLUDED.cook_time_min,
    difficulty = EXCLUDED.difficulty, type = EXCLUDED.type,
    servings = EXCLUDED.servings, country = EXCLUDED.country,
    diet = EXCLUDED.diet, ingredients = EXCLUDED.ingredients,
    description = EXCLUDED.description, steps = EXCLUDED.steps,
    allergens = EXCLUDED.allergens, image_url = EXCLUDED.image_url,
    status = EXCLUDED.status,
    title = EXCLUDED.title, is_public = EXCLUDED.is_public,
    moderation_status = EXCLUDED.moderation_status,
    admin_modified = EXCLUDED.admin_modified,
    consent_to_promote = EXCLUDED.consent_to_promote,
    moderation_reason = EXCLUDED.moderation_reason,
    deleted_at = EXCLUDED.deleted_at,
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER custom_recipes_iof_insert_trigger
  INSTEAD OF INSERT ON public.custom_recipes
  FOR EACH ROW EXECUTE FUNCTION public.custom_recipes_iof_insert();

-- INSTEAD OF UPDATE : merge partiel (data jsonb peut être NULL côté caller)
CREATE OR REPLACE FUNCTION public.custom_recipes_iof_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_new_data jsonb;
BEGIN
  v_new_data := NEW.data;

  -- Update partial : si caller envoie data complet, on extrait toutes les
  -- colonnes ; sinon on garde les valeurs existantes (la view reconstruit
  -- data depuis les colonnes, donc NEW.data peut différer même sans
  -- changement intentionnel — on compare donc à OLD.data).
  UPDATE public.recipes_unified SET
    title = NEW.title,
    name = CASE
      WHEN v_new_data IS DISTINCT FROM OLD.data AND jsonb_typeof(v_new_data->'name') = 'object' THEN v_new_data->'name'
      WHEN v_new_data IS DISTINCT FROM OLD.data AND v_new_data->>'name' IS NOT NULL THEN jsonb_build_object('fr', v_new_data->>'name')
      ELSE name
    END,
    emoji = COALESCE(v_new_data->>'emoji', emoji),
    time_min = COALESCE(
      NULLIF(regexp_replace(COALESCE(v_new_data->>'time_min', v_new_data->>'time'), '[^0-9]', '', 'g'), '')::integer,
      time_min
    ),
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
    status = CASE WHEN COALESCE(NEW.is_public, is_public) AND COALESCE(NEW.moderation_status, moderation_status) = 'approved' THEN 'published' ELSE 'draft' END,
    updated_at = now()
  WHERE id = OLD.id AND origin = 'community';

  RETURN NEW;
END;
$function$;

CREATE TRIGGER custom_recipes_iof_update_trigger
  INSTEAD OF UPDATE ON public.custom_recipes
  FOR EACH ROW EXECUTE FUNCTION public.custom_recipes_iof_update();

-- INSTEAD OF DELETE : delete recipes_unified WHERE id + origin='community'
CREATE OR REPLACE FUNCTION public.custom_recipes_iof_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  DELETE FROM public.recipes_unified
  WHERE id = OLD.id AND origin = 'community';
  RETURN OLD;
END;
$function$;

CREATE TRIGGER custom_recipes_iof_delete_trigger
  INSTEAD OF DELETE ON public.custom_recipes
  FOR EACH ROW EXECUTE FUNCTION public.custom_recipes_iof_delete();

-- ─── 9) Rewrite RPC promote_recipe_to_base sur recipes_unified ─────────────

CREATE OR REPLACE FUNCTION public.promote_recipe_to_base(p_custom_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_recipe    record;
  v_username  text;
  v_new_id    text;
  v_existing  text;
BEGIN
  -- 1. Admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden — admin only' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Charger la recette community depuis recipes_unified
  SELECT * INTO v_recipe
  FROM public.recipes_unified
  WHERE id = p_custom_id AND origin = 'community' AND deleted_at IS NULL;

  IF v_recipe IS NULL THEN
    RAISE EXCEPTION 'Recipe not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_recipe.moderation_status <> 'approved' THEN
    RAISE EXCEPTION 'Recipe must be approved before promotion (current: %)', v_recipe.moderation_status USING ERRCODE = 'P0003';
  END IF;

  IF v_recipe.consent_to_promote IS NOT TRUE THEN
    RAISE EXCEPTION 'Author has not consented to promotion (consent_to_promote = false)' USING ERRCODE = 'P0004';
  END IF;

  -- 3. Déjà promue ?
  SELECT id INTO v_existing
  FROM public.recipes_unified
  WHERE origin = 'official' AND promoted_from_id = p_custom_id;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('promoted', false, 'reason', 'already_promoted', 'base_id', v_existing);
  END IF;

  -- 4. Génération id (slug + suffix random)
  v_new_id := lower(regexp_replace(coalesce(v_recipe.title, 'recipe'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substring(md5(random()::text), 1, 6);

  -- 5. Snapshot username pour crédit
  SELECT username INTO v_username
  FROM public.profiles
  WHERE id = v_recipe.user_id;

  -- 6. Insert directement dans recipes_unified avec origin='official'
  INSERT INTO public.recipes_unified (
    id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
    difficulty, type, servings, country, diet, allergens,
    ingredients, description, steps, image_url, status,
    original_author_id, original_author_name,
    promoted_from_id, promoted_at
  ) VALUES (
    v_new_id, 'official',
    v_recipe.name, v_recipe.emoji, v_recipe.time_min,
    v_recipe.prep_time_min, v_recipe.cook_time_min,
    v_recipe.difficulty, v_recipe.type, v_recipe.servings,
    v_recipe.country, v_recipe.diet, v_recipe.allergens,
    v_recipe.ingredients, v_recipe.description, v_recipe.steps,
    v_recipe.image_url, 'published',
    v_recipe.user_id, v_username,
    p_custom_id, now()
  );

  -- 7. Notif user
  INSERT INTO public.notifications
    (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    v_recipe.user_id, 'user', 'recipe_promoted',
    jsonb_build_object(
      'fr', '🎉 Ta recette a été promue en recette officielle !',
      'en', '🎉 Your recipe has been promoted to an official recipe!',
      'es', '¡🎉 Tu receta ha sido promovida a receta oficial!',
      'de', '🎉 Dein Rezept wurde zu einem offiziellen Rezept befördert!',
      'ja', '🎉 あなたのレシピが公式レシピに昇格されました！'
    ),
    jsonb_build_object(
      'fr', COALESCE(v_recipe.title, '') || ' — bravo et merci pour ta contribution !',
      'en', COALESCE(v_recipe.title, '') || ' — congrats and thanks for your contribution!',
      'es', COALESCE(v_recipe.title, '') || ' — ¡felicidades y gracias por tu contribución!',
      'de', COALESCE(v_recipe.title, '') || ' — Glückwunsch und danke für deinen Beitrag!',
      'ja', COALESCE(v_recipe.title, '') || ' — おめでとうございます、貢献ありがとうございました！'
    ),
    '/recipes/' || v_new_id,
    jsonb_build_object('base_recipe_id', v_new_id, 'custom_recipe_id', p_custom_id)
  );

  -- 8. Log audit
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    auth.uid(), 'recipe_promoted', v_new_id, 'base_recipe',
    jsonb_build_object('promoted_from_id', p_custom_id, 'original_author_id', v_recipe.user_id)
  );

  RETURN json_build_object('promoted', true, 'base_id', v_new_id, 'custom_id', p_custom_id, 'author', v_username);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.promote_recipe_to_base(text) FROM anon;

-- ─── 10) Rewrite RPC delete_custom_recipe_rgpd sur recipes_unified ──────────

CREATE OR REPLACE FUNCTION public.delete_custom_recipe_rgpd(p_recipe_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_owner_id    uuid;
  v_favoriters  int := 0;
  v_basket      int := 0;
BEGIN
  -- Vérif existence + propriété sur recipes_unified
  SELECT user_id INTO v_owner_id
  FROM public.recipes_unified
  WHERE id = p_recipe_id AND origin = 'community';

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Recipe not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden — not owner' USING ERRCODE = 'P0001';
  END IF;

  -- Compte les références (favoris autres users + paniers)
  SELECT COUNT(*) INTO v_favoriters
  FROM public.user_favorites
  WHERE recipe_id = p_recipe_id AND user_id <> v_owner_id;

  SELECT COUNT(*) INTO v_basket
  FROM public.basket_items
  WHERE recipe_id = p_recipe_id;

  -- Notif anonyme à chaque favoriteur (sauf le propriétaire).
  IF v_favoriters > 0 THEN
    INSERT INTO public.notifications
      (recipient_id, recipient_role, type, title, body, expires_at)
    SELECT
      uf.user_id, 'user', 'favorite_recipe_deleted',
      jsonb_build_object(
        'fr', 'Une recette favorite a été supprimée',
        'en', 'A favorite recipe was deleted',
        'es', 'Una receta favorita fue eliminada',
        'de', 'Ein Lieblingsrezept wurde gelöscht',
        'ja', 'お気に入りのレシピが削除されました'
      ),
      jsonb_build_object(
        'fr', 'L''auteur a supprimé sa recette définitivement.',
        'en', 'The author permanently deleted their recipe.',
        'es', 'El autor eliminó su receta de forma permanente.',
        'de', 'Der Autor hat sein Rezept dauerhaft gelöscht.',
        'ja', '作成者がレシピを完全に削除しました。'
      ),
      now() + interval '90 days'
    FROM public.user_favorites uf
    WHERE uf.recipe_id = p_recipe_id AND uf.user_id <> v_owner_id;
  END IF;

  -- Log RGPD Art.17
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type)
  VALUES (auth.uid(), 'recipe_self_deleted_rgpd', p_recipe_id, 'recipe');

  -- Cascade manuelle
  DELETE FROM public.user_favorites WHERE recipe_id = p_recipe_id;
  DELETE FROM public.basket_items   WHERE recipe_id = p_recipe_id;

  -- Suppression définitive du row dans recipes_unified
  DELETE FROM public.recipes_unified
  WHERE id = p_recipe_id AND origin = 'community';

  RETURN json_build_object(
    'deleted',              true,
    'favoriters_notified',  v_favoriters,
    'basket_items_removed', v_basket
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_custom_recipe_rgpd(text) FROM anon;

COMMIT;
