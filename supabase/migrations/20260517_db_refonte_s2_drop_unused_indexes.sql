-- ============================================================
-- v0.16.x — Refonte BDD Sprint 2 — Drop unused + duplicate indexes (PR-DB-04)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings advisors : `project_db_advisors_findings_2026_05_17.md`
--
-- Élimine les 18 indexes inutiles signalés par les Supabase advisors :
--   - 16 indexes UNUSED (idx_scan = 0) sur 30+ jours de monitoring prod
--   - 2 indexes DUPLICATE sur `ingredients` (storage + subcategory)
--
-- Bénéfices :
--   - INSERT/UPDATE sur les tables concernées plus rapides (moins
--     d'indexes à maintenir)
--   - Stockage économisé (taille cumulée modeste mais nettoyage propre)
--   - Pas d'impact lecture : ces indexes n'étaient pas utilisés par le planner
--
-- Pour les paires duplicate : on garde l'index le PLUS utilisé selon
-- pg_stat_user_indexes.idx_scan, on drop le moins utilisé.
--
-- Si besoin de revert : il suffit de recréer les indexes à partir du
-- dump SCHEMA pré-refonte (cf. mémoire `project_db_actual_state_2026_05_17.md`).
-- ============================================================

BEGIN;

-- ─── 16 unused indexes (idx_scan = 0) ────────────────────────────────────────

-- profiles (5 unused)
DROP INDEX IF EXISTS public.idx_profiles_allergen_prefs;
DROP INDEX IF EXISTS public.idx_profiles_last_login;
DROP INDEX IF EXISTS public.idx_profiles_deleted_at;
DROP INDEX IF EXISTS public.idx_profiles_restore_token;
DROP INDEX IF EXISTS public.idx_profiles_community_muted;
DROP INDEX IF EXISTS public.profiles_subscription_status_idx;

-- base_recipes (3 unused)
DROP INDEX IF EXISTS public.idx_base_recipes_allergens;
DROP INDEX IF EXISTS public.idx_base_recipes_country;
DROP INDEX IF EXISTS public.idx_base_recipes_diet;

-- ingredients (2 unused)
DROP INDEX IF EXISTS public.idx_ingredients_allergens;
DROP INDEX IF EXISTS public.idx_ingredients_breaks_diets;

-- support_tickets (2 unused)
DROP INDEX IF EXISTS public.idx_support_tickets_target;
DROP INDEX IF EXISTS public.idx_support_tickets_reason_key;

-- community + reactions (3 unused)
DROP INDEX IF EXISTS public.idx_community_posts_created;
DROP INDEX IF EXISTS public.idx_community_replies_parent;
DROP INDEX IF EXISTS public.idx_post_reactions_post_id;

-- ─── 2 duplicate indexes sur `ingredients` ───────────────────────────────────
-- Paires identiques :
--   idx_ingredients_storage (455 scans) ↔ ingredients_storage_idx (1025 scans)
--     → garde ingredients_storage_idx (plus utilisé)
--   idx_ingredients_subcategory (47 scans) ↔ ingredients_subcategory_idx (75 scans)
--     → garde ingredients_subcategory_idx (plus utilisé)

DROP INDEX IF EXISTS public.idx_ingredients_storage;
DROP INDEX IF EXISTS public.idx_ingredients_subcategory;

COMMIT;
