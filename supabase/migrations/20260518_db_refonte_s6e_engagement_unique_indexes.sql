-- ============================================================
-- v0.16.x — Refonte BDD Sprint 6e — Engagement UNIQUE partial indexes (PR-DB-17a)
-- ------------------------------------------------------------
-- Préparation au cutover writes engagement (PR-DB-17b).
--
-- Les anciennes tables avaient des UNIQUE contraintes :
--   - community_likes        : UNIQUE (user_id, post_id)
--   - community_reply_likes  : UNIQUE (user_id, reply_id)
--   - post_reactions         : UNIQUE (user_id, post_id) — 1 reaction par user/post
--   - recipe_reviews         : UNIQUE (user_id, recipe_id)
--
-- Pour préserver cette sémantique côté `engagement` et permettre les
-- UPSERT (`.upsert({...}, { onConflict: 'user_id,target_X,type' })`) côté
-- code, on ajoute 4 UNIQUE partial indexes filtrés par type.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS engagement_unique_post_like
  ON public.engagement(user_id, target_post_id)
  WHERE type = 'post_like';

CREATE UNIQUE INDEX IF NOT EXISTS engagement_unique_reply_like
  ON public.engagement(user_id, target_reply_id)
  WHERE type = 'reply_like';

CREATE UNIQUE INDEX IF NOT EXISTS engagement_unique_reaction
  ON public.engagement(user_id, target_post_id)
  WHERE type = 'reaction';

CREATE UNIQUE INDEX IF NOT EXISTS engagement_unique_review
  ON public.engagement(user_id, target_recipe_id)
  WHERE type = 'review';

COMMIT;
