-- ============================================================
-- v0.16.x — Refonte BDD Sprint 1 — Fix function_search_path_mutable (PR-DB-03)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings advisors : `project_db_advisors_findings_2026_05_17.md`
--
-- Élimine les 13 advisors WARN `function_search_path_mutable` :
-- les fonctions sans `SET search_path` peuvent être détournées si un
-- attaquant a créé un schéma malveillant en amont du PATH par défaut.
-- Verrouillage à `public, pg_catalog` (les seuls schémas que ces fonctions
-- référencent — toutes opèrent sur des tables public + types built-in).
--
-- Aucune fonction concernée ne touche `auth.*` ou `private.*` directement
-- (ce sont des helpers community, triggers updated_at, et 2 helpers RLS
-- community_can_post/reply qui consultent `public.profiles`).
--
-- Pattern : ALTER FUNCTION ... SET search_path = public, pg_catalog
-- Idempotent. Transaction atomique.
-- ============================================================

BEGIN;

ALTER FUNCTION public.community_can_post(uuid)              SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_can_reply(uuid)             SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_post_likes_count_fn()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_replies_count_fn()          SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_replies_limit_depth_fn()    SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_reply_likes_count_fn()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.community_set_updated_at_fn()         SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_profiling_opted_out(uuid)          SET search_path = public, pg_catalog;
ALTER FUNCTION public.recipe_reviews_set_updated_at_fn()    SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at()                      SET search_path = public, pg_catalog;
ALTER FUNCTION public.shopping_lists_set_updated_at()       SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_updated_at()                    SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at()                   SET search_path = public, pg_catalog;

COMMIT;
