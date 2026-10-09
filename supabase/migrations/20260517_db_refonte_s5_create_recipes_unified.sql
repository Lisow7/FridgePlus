-- ============================================================
-- v0.16.x — Refonte BDD Sprint 5 — Create recipes_unified + seed (PR-DB-10)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Objectif Sprint 5 : fusionner `base_recipes` (101 rows) et `custom_recipes`
-- (6 rows) en une seule table `recipes_unified` avec colonne discriminator
-- `origin` ('official' | 'community').
--
-- PR-DB-10 (cette migration) — Création + seed snapshot, SQL-only :
--   - CREATE TABLE recipes_unified avec union des colonnes des 2 sources
--   - RLS conforme Sprint 1 (lecture publique pour officials/published,
--     lecture privée pour community privé/draft, write admin)
--   - SEED 107 rows : base_recipes → 'official', custom_recipes → 'community'
--     (extract jsonb data pour les communauté)
--   - Aucun trigger de sync (PR-DB-12 plus tard)
--
-- ⚠️ Les 2 anciennes tables restent SOURCE DE VÉRITÉ pour les writes
-- jusqu'à PR-DB-12. PR-DB-11 (à venir) : switch reads dans data-provider.
-- ============================================================

BEGIN;

-- ─── 1) Table recipes_unified ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recipes_unified (
  id              text PRIMARY KEY,
  origin          text NOT NULL CHECK (origin IN ('official', 'community')),

  -- ─── Champs communs (officials + community) ─────
  name            jsonb NOT NULL DEFAULT '{}',
  emoji           text NOT NULL DEFAULT '🍳',
  time_min        integer NOT NULL DEFAULT 30,
  prep_time_min   integer,
  cook_time_min   integer,
  difficulty      text NOT NULL DEFAULT 'medium',
  type            text NOT NULL DEFAULT 'main',
  servings        integer NOT NULL DEFAULT 2,
  country         text,
  diet            jsonb NOT NULL DEFAULT '[]',
  ingredients     jsonb NOT NULL DEFAULT '[]',
  description     jsonb NOT NULL DEFAULT '{}',
  steps           jsonb NOT NULL DEFAULT '{}',
  allergens       text[] NOT NULL DEFAULT '{}',
  image_url       text,
  status          text NOT NULL DEFAULT 'published',

  -- ─── Officials uniquement (NULL pour community) ─────
  original_author_id    uuid,
  original_author_name  text,
  promoted_from_id      text,
  promoted_at           timestamptz,

  -- ─── Community uniquement (NULL pour officials) ─────
  user_id               uuid,
  is_public             boolean,
  moderation_status     text,
  admin_modified        boolean,
  consent_to_promote    boolean,
  deleted_at            timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recipes_unified IS
  'Table fusionnée recettes officielles + community. Refonte BDD Sprint 5. Discriminator `origin`. Reads source à partir de PR-DB-11. Writes admin via anciennes tables jusqu''à PR-DB-12.';
COMMENT ON COLUMN public.recipes_unified.origin IS 'official = base_recipes, community = custom_recipes';

CREATE INDEX IF NOT EXISTS recipes_unified_origin_status_idx
  ON public.recipes_unified(origin, status);
CREATE INDEX IF NOT EXISTS recipes_unified_user_id_idx
  ON public.recipes_unified(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS recipes_unified_deleted_at_idx
  ON public.recipes_unified(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER recipes_unified_touch_updated_at
  BEFORE UPDATE ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 2) RLS — conforme Sprint 1 (wrap + search_path) ──
ALTER TABLE public.recipes_unified ENABLE ROW LEVEL SECURITY;

-- SELECT : officials/published lisibles par tous, community visibles selon moderation + ownership
CREATE POLICY recipes_unified_select_official_public ON public.recipes_unified
  AS PERMISSIVE FOR SELECT TO public
  USING (origin = 'official' AND status IN ('published', 'featured'));

CREATE POLICY recipes_unified_select_community_public ON public.recipes_unified
  AS PERMISSIVE FOR SELECT TO public
  USING (origin = 'community' AND is_public = true AND moderation_status = 'approved' AND deleted_at IS NULL);

CREATE POLICY recipes_unified_select_own ON public.recipes_unified
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (origin = 'community' AND user_id = (select auth.uid()) AND deleted_at IS NULL);

CREATE POLICY recipes_unified_select_admin ON public.recipes_unified
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT/UPDATE/DELETE admin only (les writes app vont encore sur les anciennes tables jusqu'à PR-DB-12)
CREATE POLICY recipes_unified_insert_admin ON public.recipes_unified
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY recipes_unified_update_admin ON public.recipes_unified
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY recipes_unified_delete_admin ON public.recipes_unified
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

-- ─── 3) SEED officials (101 rows depuis base_recipes) ────────────────────────
INSERT INTO public.recipes_unified (
  id, origin, name, emoji, time_min, prep_time_min, cook_time_min,
  difficulty, type, servings, country, diet, ingredients,
  description, steps, allergens, image_url, status,
  original_author_id, original_author_name, promoted_from_id, promoted_at,
  created_at, updated_at
)
SELECT
  id, 'official', name, emoji, time_min, prep_time_min, cook_time_min,
  difficulty, type, servings, country, diet, ingredients,
  description, steps, allergens, image_url, status,
  original_author_id, original_author_name, promoted_from_id, promoted_at,
  created_at, updated_at
FROM public.base_recipes
ON CONFLICT (id) DO NOTHING;

-- ─── 4) SEED community (6 rows depuis custom_recipes, extract jsonb data) ────
-- Note : `data` jsonb contient name, emoji, time, type, difficulty, country,
-- servings, diet, ingredients, steps, allergens, isCustom (redondant).
-- On utilise les top-level columns custom_recipes pour is_public,
-- moderation_status, consent_to_promote, admin_modified, deleted_at, user_id.
INSERT INTO public.recipes_unified (
  id, origin, name, emoji, time_min, difficulty, type, servings, country,
  diet, ingredients, steps, allergens, status,
  user_id, is_public, moderation_status, admin_modified, consent_to_promote, deleted_at,
  created_at, updated_at
)
SELECT
  cr.id,
  'community',
  -- name : si data->'name' est jsonb (5 langues), garder ; sinon wrap title en {fr: title}
  CASE
    WHEN jsonb_typeof(cr.data->'name') = 'object' THEN cr.data->'name'
    WHEN cr.data->>'name' IS NOT NULL THEN jsonb_build_object('fr', cr.data->>'name')
    ELSE jsonb_build_object('fr', cr.title)
  END,
  COALESCE(cr.data->>'emoji', '🍳'),
  -- time : peut être numeric string ou "30 min" — extract \d+ ou default
  COALESCE(NULLIF(regexp_replace(COALESCE(cr.data->>'time', '30'), '[^0-9]', '', 'g'), '')::integer, 30),
  COALESCE(cr.data->>'difficulty', 'medium'),
  COALESCE(cr.data->>'type', 'main'),
  COALESCE(NULLIF(cr.data->>'servings', '')::integer, 2),
  cr.data->>'country',
  COALESCE(cr.data->'diet', '[]'::jsonb),
  COALESCE(cr.data->'ingredients', '[]'::jsonb),
  COALESCE(cr.data->'steps', '{}'::jsonb),
  -- allergens : jsonb array → text[]
  COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(cr.data->'allergens')),
    '{}'::text[]
  ),
  CASE WHEN cr.is_public AND cr.moderation_status = 'approved' THEN 'published' ELSE 'draft' END,
  cr.user_id,
  cr.is_public,
  cr.moderation_status,
  COALESCE(cr.admin_modified, false),
  cr.consent_to_promote,
  cr.deleted_at,
  cr.created_at,
  cr.updated_at
FROM public.custom_recipes cr
ON CONFLICT (id) DO NOTHING;

COMMIT;
