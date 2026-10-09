-- ============================================================
-- v0.16.x — Refonte Recettes Phase 1 — Schema BDD foundation
-- ------------------------------------------------------------
-- Foundation pour la refonte complète de la partie "Recette" du panel
-- Recettes. 3 nouvelles tables + extensions recipes_unified + trigger
-- auto-derivation allergens/diet + RLS admin-only.
--
-- Spec source : la conception « recipes-massive-import-and-validation » du 2026-05-18
-- Plan source : le plan « recipes-refonte-phase1-schema-bdd » du 2026-05-18
--
-- Phases suivantes (pas dans cette PR) :
-- Phase 2 validators, Phase 3 adapters, Phase 4 CLI + pg_cron, Phase 5
-- admin UI Qualité v3, Phase 6 run import prod, Phase 7+ relations/UX/cost.
--
-- Rollback : DROP TABLE + DROP FUNCTION en cascade reverse.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) recipe_imports_staging — pipeline DLQ pattern
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE public.recipe_imports_staging (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id            uuid NOT NULL,
  source              text NOT NULL CHECK (source IN (
                        'themealdb', 'ia_batch', 'json_file', 'admin_ui',
                        'backfill_audit'
                      )),
  external_key        text,
  raw_payload         jsonb NOT NULL,
  parsed_data         jsonb NOT NULL,
  errors              jsonb NOT NULL DEFAULT '[]',
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'valid', 'invalid', 'admin_review',
                        'published', 'rejected'
                      )),
  admin_notes         text,
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  published_recipe_id text,
  existing_recipe_id  text REFERENCES recipes_unified(id) ON DELETE SET NULL,
  backfill_audit      boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_key)
);

COMMENT ON TABLE public.recipe_imports_staging IS
  'Refonte Recettes Phase 1. Pipeline DLQ pattern : raw_payload (intact) + parsed_data + errors persistantes (jamais NULL/discard). Admin queue via status=invalid/admin_review. RGPD : 0 PII, RLS admin-only.';

COMMENT ON COLUMN public.recipe_imports_staging.raw_payload IS
  'Snapshot intact du source au moment de l''import. Permet replay sans re-fetch.';

COMMENT ON COLUMN public.recipe_imports_staging.errors IS
  'Array d''objets [{field, code, raw, suggested, severity}]. Persistantes pour admin correction inline.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) recipe_relations — graph 8 types
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE public.recipe_relations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_a_id     text NOT NULL REFERENCES recipes_unified(id) ON DELETE CASCADE,
  recipe_b_id     text NOT NULL REFERENCES recipes_unified(id) ON DELETE CASCADE,
  relation_type   text NOT NULL CHECK (relation_type IN (
                    'variant_dietary',
                    'variant_regional',
                    'variant_occasion',
                    'sub_recipe',
                    'family',
                    'pairs_well',
                    'leftover_use',
                    'substitution'
                  )),
  metadata        jsonb,
  weight          smallint NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_a_id, recipe_b_id, relation_type),
  CHECK (recipe_a_id <> recipe_b_id)
);

COMMENT ON TABLE public.recipe_relations IS
  'Refonte Recettes Phase 1. Graph 8 types de relations entre recettes (variantes, sub_recipe, family, pairs). Permet UX modulaire (béchamel = composant réutilisable).';

COMMENT ON COLUMN public.recipe_relations.metadata IS
  'Données contextuelles par type : pour sub_recipe = {scale:1.5}, pour variant_dietary = {dietary_type:''vegan''}.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) recipe_import_events — event sourcing light
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE public.recipe_import_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_id      uuid REFERENCES recipe_imports_staging(id) ON DELETE CASCADE,
  event_type      text NOT NULL CHECK (event_type IN (
                    'imported',
                    'validated',
                    'invalidated',
                    'admin_claimed',
                    'admin_edited',
                    'revalidated',
                    'published',
                    'rejected',
                    'unpublished'
                  )),
  actor_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  payload         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recipe_import_events IS
  'Refonte Recettes Phase 1. Event sourcing light : tous les changements sur staging tracés (replay + forensique + métriques). RGPD : actor_id SET NULL si user supprime compte.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) Extensions recipes_unified — functional_tags
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.recipes_unified
  ADD COLUMN IF NOT EXISTS functional_tags text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.recipes_unified.functional_tags IS
  'Refonte Recettes Phase 1 (D15). Tags fonctionnels : quick, economical, anti_waste, batch_cooking, freezer_friendly, make_ahead, one_pot, no_cook, kids_friendly. Filtres panel D15-D17.';

CREATE INDEX IF NOT EXISTS recipes_unified_functional_tags_gin_idx
  ON public.recipes_unified USING gin(functional_tags);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) Indexes optimisés
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX recipe_imports_staging_status_pending_idx
  ON public.recipe_imports_staging(status, created_at)
  WHERE status IN ('pending', 'admin_review');

CREATE INDEX recipe_imports_staging_batch_id_idx
  ON public.recipe_imports_staging(batch_id);

CREATE INDEX recipe_imports_staging_backfill_idx
  ON public.recipe_imports_staging(existing_recipe_id)
  WHERE backfill_audit = true;

CREATE INDEX recipe_relations_a_type_idx
  ON public.recipe_relations(recipe_a_id, relation_type);

CREATE INDEX recipe_relations_b_type_idx
  ON public.recipe_relations(recipe_b_id, relation_type);

CREATE INDEX recipe_import_events_staging_time_idx
  ON public.recipe_import_events(staging_id, created_at);

CREATE INDEX recipe_import_events_actor_idx
  ON public.recipe_import_events(actor_id, created_at)
  WHERE actor_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) RLS policies — admin only (staging + events), public read (relations)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.recipe_imports_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_relations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_import_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY recipe_imports_staging_admin ON public.recipe_imports_staging
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY recipe_relations_select ON public.recipe_relations
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY recipe_relations_admin_insert ON public.recipe_relations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY recipe_relations_admin_update ON public.recipe_relations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY recipe_relations_admin_delete ON public.recipe_relations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY recipe_import_events_admin ON public.recipe_import_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) Triggers — updated_at + auto-derivation allergens/diet (D22)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TRIGGER recipe_imports_staging_touch_updated_at
  BEFORE UPDATE ON public.recipe_imports_staging
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- D22 — Auto-derive recipes_unified.allergens + diet depuis ingredients
CREATE OR REPLACE FUNCTION public.derive_recipe_allergens_and_diets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_ingredient_ids text[];
  v_derived_allergens text[];
  v_breaking_diets text[];
  v_all_diets text[] := ARRAY['vegan','vegetarian','gluten_free','dairy_free','nut_free','keto','paleo','halal','kosher','pescatarian'];
BEGIN
  -- Extract ingredient IDs depuis le format MVP (array plat)
  SELECT array_agg(DISTINCT (item->>'id')::text) INTO v_ingredient_ids
  FROM jsonb_array_elements(COALESCE(NEW.ingredients, '[]'::jsonb)) item
  WHERE item ? 'id' AND (item->>'id') IS NOT NULL;

  IF v_ingredient_ids IS NULL OR cardinality(v_ingredient_ids) = 0 THEN
    RETURN NEW;
  END IF;

  -- Aggregate allergens depuis catalogue ingredients
  SELECT array_agg(DISTINCT a) INTO v_derived_allergens
  FROM public.ingredients i, unnest(COALESCE(i.allergens, '{}'::text[])) a
  WHERE i.id = ANY(v_ingredient_ids);

  -- Aggregate diets cassés
  SELECT array_agg(DISTINCT bd) INTO v_breaking_diets
  FROM public.ingredients i, unnest(COALESCE(i.breaks_diets, '{}'::text[])) bd
  WHERE i.id = ANY(v_ingredient_ids);

  -- Auto-assign
  NEW.allergens := COALESCE(v_derived_allergens, '{}'::text[]);

  -- diet = liste des diets qui ne sont PAS cassés
  NEW.diet := COALESCE(
    (SELECT jsonb_agg(d) FROM unnest(v_all_diets) d
     WHERE NOT (d = ANY(COALESCE(v_breaking_diets, '{}'::text[])))),
    '[]'::jsonb
  );

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.derive_recipe_allergens_and_diets() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER recipes_unified_derive_allergens_diets
  BEFORE INSERT OR UPDATE OF ingredients ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.derive_recipe_allergens_and_diets();

COMMIT;
