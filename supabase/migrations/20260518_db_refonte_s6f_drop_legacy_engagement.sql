-- ============================================================
-- v0.16.x — Refonte BDD Sprint 6f — DROP legacy engagement tables (PR-DB-17b)
-- ------------------------------------------------------------
-- Finalisation Sprint 6 (engagement fusion via Exclusive Arc).
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Les 4 anciennes tables (community_likes, community_reply_likes,
-- post_reactions, recipe_reviews) sont remplacées par `engagement`.
--   - PR-DB-14 : création table + seed
--   - PR-DB-15 : sync triggers
--   - PR-DB-16a/b : switch reads
--   - PR-DB-17a : cutover writes
-- Cette PR finalise : update RPCs admin + DROP triggers/functions + DROP tables.
--
-- Pré-vérifs :
-- - grep src/: 0 .from('<old_table>') write/read côté code app
-- - Sync triggers ont fait leur job (PR-DB-17a writes vers engagement direct)
-- - Counts engagement match cumul anciennes (no drift)
-- ============================================================

BEGIN;

-- ─── 1) Update 2 RPC admin pour cibler engagement ──────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_soft_delete(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.engagement
    SET deleted_at = now(), deleted_by_admin = true
    WHERE id = p_review_id AND type = 'review';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_review_soft_delete(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.admin_review_hard_delete(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  DELETE FROM public.engagement WHERE id = p_review_id AND type = 'review';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_review_hard_delete(uuid) FROM anon;

-- ─── 2) DROP 4 sync triggers + 4 sync functions ────────────────────────────
DROP TRIGGER IF EXISTS community_likes_sync_engagement ON public.community_likes;
DROP TRIGGER IF EXISTS community_reply_likes_sync_engagement ON public.community_reply_likes;
DROP TRIGGER IF EXISTS post_reactions_sync_engagement ON public.post_reactions;
DROP TRIGGER IF EXISTS recipe_reviews_sync_engagement ON public.recipe_reviews;

DROP FUNCTION IF EXISTS public.sync_community_likes_to_engagement();
DROP FUNCTION IF EXISTS public.sync_community_reply_likes_to_engagement();
DROP FUNCTION IF EXISTS public.sync_post_reactions_to_engagement();
DROP FUNCTION IF EXISTS public.sync_recipe_reviews_to_engagement();

-- ─── 3) DROP 4 tables anciennes ────────────────────────────────────────────
DROP TABLE IF EXISTS public.community_likes CASCADE;
DROP TABLE IF EXISTS public.community_reply_likes CASCADE;
DROP TABLE IF EXISTS public.post_reactions CASCADE;
DROP TABLE IF EXISTS public.recipe_reviews CASCADE;

COMMIT;
