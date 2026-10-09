-- ============================================================
-- v0.16.x — Refonte BDD Sprint 6 — Sync triggers → engagement (PR-DB-15)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Ajoute 4 sync triggers uni-directionnels (anciennes tables → engagement)
-- pour absence de drift avant le switch reads en PR-DB-16.
--
-- Sources : community_likes, community_reply_likes, post_reactions,
-- recipe_reviews. Target : engagement avec Exclusive Arc.
--
-- Particularités :
--   - community_likes / community_reply_likes / post_reactions : pas d'id
--     propre côté source → DELETE-then-INSERT par identité fonctionnelle
--     (user_id + target + type [+ emoji pour reactions])
--   - recipe_reviews : id uuid propre → UPSERT classique par PK
--
-- Toutes les functions sont SECURITY DEFINER + SET search_path = public, pg_catalog
-- + REVOKE EXECUTE FROM anon (conformes Sprint 1).
-- ============================================================

BEGIN;

-- ─── 1) community_likes → engagement (type='post_like') ──────────────────────
CREATE OR REPLACE FUNCTION public.sync_community_likes_to_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.engagement
    WHERE type = 'post_like' AND user_id = OLD.user_id AND target_post_id = OLD.post_id;
    RETURN OLD;
  END IF;

  -- UPDATE = rare sur likes (immutables en pratique), traite comme delete + insert
  IF (TG_OP = 'UPDATE') THEN
    DELETE FROM public.engagement
    WHERE type = 'post_like' AND user_id = OLD.user_id AND target_post_id = OLD.post_id;
  END IF;

  INSERT INTO public.engagement (user_id, type, target_post_id, created_at)
  VALUES (NEW.user_id, 'post_like', NEW.post_id, NEW.created_at);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_community_likes_to_engagement() FROM anon;

DROP TRIGGER IF EXISTS community_likes_sync_engagement ON public.community_likes;
CREATE TRIGGER community_likes_sync_engagement
  AFTER INSERT OR UPDATE OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_likes_to_engagement();

-- ─── 2) community_reply_likes → engagement (type='reply_like') ───────────────
CREATE OR REPLACE FUNCTION public.sync_community_reply_likes_to_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.engagement
    WHERE type = 'reply_like' AND user_id = OLD.user_id AND target_reply_id = OLD.reply_id;
    RETURN OLD;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    DELETE FROM public.engagement
    WHERE type = 'reply_like' AND user_id = OLD.user_id AND target_reply_id = OLD.reply_id;
  END IF;

  INSERT INTO public.engagement (user_id, type, target_reply_id, created_at)
  VALUES (NEW.user_id, 'reply_like', NEW.reply_id, NEW.created_at);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_community_reply_likes_to_engagement() FROM anon;

DROP TRIGGER IF EXISTS community_reply_likes_sync_engagement ON public.community_reply_likes;
CREATE TRIGGER community_reply_likes_sync_engagement
  AFTER INSERT OR UPDATE OR DELETE ON public.community_reply_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_community_reply_likes_to_engagement();

-- ─── 3) post_reactions → engagement (type='reaction', avec emoji) ────────────
CREATE OR REPLACE FUNCTION public.sync_post_reactions_to_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.engagement
    WHERE type = 'reaction' AND user_id = OLD.user_id
      AND target_post_id = OLD.post_id AND emoji = OLD.emoji;
    RETURN OLD;
  END IF;

  -- UPDATE peut changer emoji → on supprime l'ancien combo
  IF (TG_OP = 'UPDATE') THEN
    DELETE FROM public.engagement
    WHERE type = 'reaction' AND user_id = OLD.user_id
      AND target_post_id = OLD.post_id AND emoji = OLD.emoji;
  END IF;

  INSERT INTO public.engagement (user_id, type, target_post_id, emoji, created_at)
  VALUES (NEW.user_id, 'reaction', NEW.post_id, NEW.emoji, COALESCE(NEW.created_at, now()));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_post_reactions_to_engagement() FROM anon;

DROP TRIGGER IF EXISTS post_reactions_sync_engagement ON public.post_reactions;
CREATE TRIGGER post_reactions_sync_engagement
  AFTER INSERT OR UPDATE OR DELETE ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_reactions_to_engagement();

-- ─── 4) recipe_reviews → engagement (type='review', UPSERT par PK uuid) ──────
CREATE OR REPLACE FUNCTION public.sync_recipe_reviews_to_engagement()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.engagement WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  -- INSERT ou UPDATE : UPSERT par PK uuid (preserve id pour links externes)
  INSERT INTO public.engagement (
    id, user_id, type, target_recipe_id, rating, body,
    deleted_at, deleted_by_admin, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.user_id, 'review', NEW.recipe_id, NEW.rating, NEW.body,
    NEW.deleted_at, NEW.deleted_by_admin, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    rating           = EXCLUDED.rating,
    body             = EXCLUDED.body,
    deleted_at       = EXCLUDED.deleted_at,
    deleted_by_admin = EXCLUDED.deleted_by_admin,
    updated_at       = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.sync_recipe_reviews_to_engagement() FROM anon;

DROP TRIGGER IF EXISTS recipe_reviews_sync_engagement ON public.recipe_reviews;
CREATE TRIGGER recipe_reviews_sync_engagement
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_recipe_reviews_to_engagement();

COMMIT;
