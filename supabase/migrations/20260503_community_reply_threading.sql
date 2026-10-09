-- ============================================================
-- v3.16.0 — Threading des réponses + likes sur réponses
-- ------------------------------------------------------------
-- Étend le système de communauté livré en v3.15.x avec :
--   1. Threading 1 niveau max sur community_replies (parent_reply_id)
--   2. Likes sur les réponses (community_reply_likes)
--
-- RGPD :
--   • Aucune nouvelle PII stockée
--   • ON DELETE CASCADE sur parent_reply_id : si une reply parente est
--     hard-supprimée, les sous-réponses partent avec (cohérent avec le
--     pattern post → replies)
--   • Soft-delete propagé visuellement côté UI (parent soft-deleted
--     reste affiché « Réponse supprimée », enfants visibles)
--   • Likes : ON DELETE CASCADE sur reply_id et user_id (purge auto)
-- ============================================================

-- ─── 1. Threading sur community_replies ────────────────────────────────

ALTER TABLE public.community_replies
  ADD COLUMN IF NOT EXISTS parent_reply_id uuid
    REFERENCES public.community_replies(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.community_replies.parent_reply_id IS
  'v3.16.0 — Si non NULL, cette réponse répond à une autre réponse (1 niveau max). NULL = réponse directe au post.';

CREATE INDEX IF NOT EXISTS idx_community_replies_parent
  ON public.community_replies (parent_reply_id, created_at ASC)
  WHERE parent_reply_id IS NOT NULL AND deleted_at IS NULL;

-- ─── 2. Trigger : limite 1 niveau de profondeur ────────────────────────
-- Une réponse ne peut avoir comme parent qu'une réponse RACINE
-- (parent_reply_id IS NULL chez le parent).

CREATE OR REPLACE FUNCTION public.community_replies_limit_depth_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_reply_id IS NOT NULL THEN
    PERFORM 1 FROM public.community_replies
      WHERE id = NEW.parent_reply_id
        AND parent_reply_id IS NOT NULL;
    IF FOUND THEN
      RAISE EXCEPTION 'reply_depth_exceeded: max 1 level of nesting';
    END IF;
    -- Cohérence : la reply enfant doit appartenir au même post que le parent
    PERFORM 1 FROM public.community_replies
      WHERE id = NEW.parent_reply_id
        AND post_id = NEW.post_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reply_post_mismatch: parent reply belongs to a different post';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_replies_limit_depth_trg ON public.community_replies;
CREATE TRIGGER community_replies_limit_depth_trg
BEFORE INSERT OR UPDATE OF parent_reply_id, post_id ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.community_replies_limit_depth_fn();

-- ─── 3. Compteur de likes dénormalisé sur replies ──────────────────────

ALTER TABLE public.community_replies
  ADD COLUMN IF NOT EXISTS likes_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.community_replies.likes_count IS
  'v3.16.0 — Compteur dénormalisé maintenu par trigger sur community_reply_likes.';

-- ─── 4. Table community_reply_likes ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_reply_likes (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reply_id   uuid        NOT NULL REFERENCES public.community_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reply_id)
);

CREATE INDEX IF NOT EXISTS idx_community_reply_likes_reply
  ON public.community_reply_likes (reply_id);

-- RLS
ALTER TABLE public.community_reply_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read reply likes" ON public.community_reply_likes;
CREATE POLICY "Public read reply likes" ON public.community_reply_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own reply likes" ON public.community_reply_likes;
CREATE POLICY "Users insert own reply likes" ON public.community_reply_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reply likes" ON public.community_reply_likes;
CREATE POLICY "Users delete own reply likes" ON public.community_reply_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 5. Trigger : maintien likes_count sur community_replies ───────────

CREATE OR REPLACE FUNCTION public.community_reply_likes_count_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_replies
      SET likes_count = likes_count + 1
      WHERE id = NEW.reply_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_replies
      SET likes_count = GREATEST(0, likes_count - 1)
      WHERE id = OLD.reply_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_reply_likes_count_trg ON public.community_reply_likes;
CREATE TRIGGER community_reply_likes_count_trg
AFTER INSERT OR DELETE ON public.community_reply_likes
FOR EACH ROW EXECUTE FUNCTION public.community_reply_likes_count_fn();
