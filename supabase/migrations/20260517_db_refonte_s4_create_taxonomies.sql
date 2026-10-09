-- ============================================================
-- v0.16.x — Refonte BDD Sprint 4 — Create `taxonomies` + seed (PR-DB-07)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Objectif Sprint 4 : fusionner 6 tables masters (`allergen_types`,
-- `diet_types`, `countries_master`, `difficulty_types`, `meal_types`,
-- `ingredient_subcategories`) en une seule table `taxonomies` générique.
--
-- PR-DB-07 (cette migration) — Création table + seed snapshot, SQL-only :
--   - CREATE TABLE taxonomies (id PK serial + UNIQUE domain,key)
--   - RLS conforme Sprint 1 (wrap auth, search_path, séparation cmd)
--   - SEED initial : INSERT 69 rows depuis les 6 tables actuelles (14+5+8+4+5+33)
--   - Aucun trigger de sync (PR-DB-09 plus tard)
--
-- ⚠️ Les 6 anciennes tables restent SOURCE DE VÉRITÉ pour les writes admin
-- jusqu'à PR-DB-09. Si un admin édite une ancienne table entre PR-DB-07 et
-- PR-DB-09, il y aura un drift dans taxonomies. Réparation : re-run le seed
-- (ON CONFLICT DO NOTHING).
--
-- PR-DB-08 (à venir) : data-provider.jsx lit `taxonomies` filtré par domain.
-- PR-DB-09 (à venir) : bascule writes admin vers taxonomies + drop 6 tables.
-- ============================================================

BEGIN;

-- ─── 1) Table taxonomies ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.taxonomies (
  id          serial PRIMARY KEY,
  domain      text NOT NULL,
  key         text NOT NULL,
  labels      jsonb NOT NULL DEFAULT '{}',
  metadata    jsonb NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxonomies_domain_check CHECK (domain IN ('allergen','diet','country','difficulty','meal_type','ingredient_subcat')),
  CONSTRAINT taxonomies_domain_key_unique UNIQUE (domain, key)
);

COMMENT ON TABLE public.taxonomies IS
  'Référentiel générique multi-domaine (allergènes, régimes, pays, difficultés, types de plats, sous-catégories ingrédients). Refonte BDD Sprint 4. Source de vérité pour les reads à partir de PR-DB-08. Les writes admin transitent encore par les 6 anciennes tables jusqu''à PR-DB-09.';
COMMENT ON COLUMN public.taxonomies.domain IS 'Domaine de taxonomie (CHECK liste fermée)';
COMMENT ON COLUMN public.taxonomies.key IS 'Clé unique au sein du domaine (ex: ''gluten'' pour domain=allergen)';
COMMENT ON COLUMN public.taxonomies.labels IS 'Libellés multilingues {fr,en,es,de,ja}';
COMMENT ON COLUMN public.taxonomies.metadata IS 'Métadonnées variables par domaine (icon/emoji/flag/color/bg_color/text_color/storage_prefix)';

-- Index : sort_order + domain pour les SELECT triés par domain
CREATE INDEX IF NOT EXISTS taxonomies_domain_sort_idx
  ON public.taxonomies(domain, sort_order);

-- Trigger updated_at
CREATE TRIGGER taxonomies_touch_updated_at
  BEFORE UPDATE ON public.taxonomies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 2) RLS — conforme Sprint 1 (wrap, search_path déjà fixé via touch_updated_at) ──
ALTER TABLE public.taxonomies ENABLE ROW LEVEL SECURITY;

-- SELECT public (donnée non sensible, exposée à anon + authenticated)
CREATE POLICY taxonomies_select_public ON public.taxonomies
  AS PERMISSIVE FOR SELECT TO public
  USING (true);

-- INSERT/UPDATE/DELETE admin uniquement (via is_admin() wrap)
CREATE POLICY taxonomies_insert_admin ON public.taxonomies
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY taxonomies_update_admin ON public.taxonomies
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY taxonomies_delete_admin ON public.taxonomies
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

-- ─── 3) SEED initial : INSERT 69 rows depuis les 6 tables ────────────────────

-- 3a) allergen_types (14 rows attendus)
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'allergen', key, labels,
       jsonb_strip_nulls(jsonb_build_object('icon', icon)),
       COALESCE(sort_order, 0)
FROM public.allergen_types
ON CONFLICT (domain, key) DO NOTHING;

-- 3b) diet_types (5 rows attendus)
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'diet', key, labels,
       jsonb_strip_nulls(jsonb_build_object('color', color, 'bg_color', bg_color)),
       COALESCE(sort_order, 0)
FROM public.diet_types
ON CONFLICT (domain, key) DO NOTHING;

-- 3c) countries_master (8 rows attendus) — colonne names au lieu de labels
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'country', code, names,
       jsonb_strip_nulls(jsonb_build_object('flag', flag)),
       COALESCE(sort_order, 0)
FROM public.countries_master
ON CONFLICT (domain, key) DO NOTHING;

-- 3d) difficulty_types (4 rows attendus)
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'difficulty', key, labels,
       jsonb_strip_nulls(jsonb_build_object('color', color)),
       COALESCE(sort_order, 0)
FROM public.difficulty_types
ON CONFLICT (domain, key) DO NOTHING;

-- 3e) meal_types (5 rows attendus)
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'meal_type', key, labels,
       jsonb_strip_nulls(jsonb_build_object('icon', icon)),
       COALESCE(sort_order, 0)
FROM public.meal_types
ON CONFLICT (domain, key) DO NOTHING;

-- 3f) ingredient_subcategories (33 rows attendus)
INSERT INTO public.taxonomies (domain, key, labels, metadata, sort_order)
SELECT 'ingredient_subcat', key, labels,
       jsonb_strip_nulls(jsonb_build_object(
         'emoji', emoji,
         'bg_color', bg_color,
         'text_color', text_color,
         'storage_prefix', storage_prefix
       )),
       COALESCE(sort_order, 0)
FROM public.ingredient_subcategories
ON CONFLICT (domain, key) DO NOTHING;

COMMIT;
