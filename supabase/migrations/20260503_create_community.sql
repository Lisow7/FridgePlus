-- ============================================================
-- v3.15.0 — Communauté (posts, réponses, likes)
-- ------------------------------------------------------------
-- Trois tables :
--   • community_posts    — un post = titre + corps + catégorie
--   • community_replies  — réponses plates à un post
--   • community_likes    — likes user → post (pas sur réponses au MVP)
--
-- RGPD :
--   • ON DELETE SET NULL sur user_id (pas CASCADE) → quand le compte est
--     supprimé, le post/reply reste mais devient « Utilisateur supprimé »
--     pour préserver la cohérence des fils de discussion.
--   • Soft delete via deleted_at sur posts et replies → l'utilisateur peut
--     restaurer dans un délai court (24h via UI client).
--   • Lecture publique (anon + connecté) sur les posts non soft-delete.
--   • Insert/update/delete réservés au propriétaire (user_id = auth.uid()).
--   • Pas de PII supplémentaire stockée — juste user_id, contenu, dates.
--
-- Anti-spam :
--   • RPC community_can_post(uid) renvoie true si < 5 posts créés sur les
--     dernières 24h. Appelé côté client avant submit.
--   • RPC community_can_reply(uid) idem mais 30 réponses / 24h.
--   • Pas de rate limit serveur strict au MVP (à monter en hardening si
--     les abus apparaissent).
--
-- Compteurs dénormalisés :
--   • likes_count et replies_count sur community_posts maintenus par
--     triggers AFTER INSERT/UPDATE/DELETE. Évite des COUNT() au listing.
-- ============================================================

-- ─── Tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_posts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  category      text        NOT NULL CHECK (category IN ('tips', 'questions', 'pride', 'feedback', 'general')),
  title         text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body          text        NOT NULL CHECK (char_length(body) BETWEEN 10 AND 5000),
  likes_count   int         NOT NULL DEFAULT 0,
  replies_count int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_created
  ON public.community_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_category
  ON public.community_posts (category, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_posts_user
  ON public.community_posts (user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.community_replies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_community_replies_post
  ON public.community_replies (post_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_replies_user
  ON public.community_replies (user_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.community_likes (
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    uuid        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_community_likes_post
  ON public.community_likes (post_id);

-- ─── Triggers : compteurs dénormalisés ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.community_post_likes_count_fn() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_likes_count_trg ON public.community_likes;
CREATE TRIGGER community_likes_count_trg
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.community_post_likes_count_fn();

CREATE OR REPLACE FUNCTION public.community_replies_count_fn() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL THEN
    UPDATE public.community_posts SET replies_count = replies_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE public.community_posts SET replies_count = GREATEST(0, replies_count - 1) WHERE id = NEW.post_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.community_posts SET replies_count = replies_count + 1 WHERE id = NEW.post_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.deleted_at IS NULL THEN
    UPDATE public.community_posts SET replies_count = GREATEST(0, replies_count - 1) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS community_replies_count_trg ON public.community_replies;
CREATE TRIGGER community_replies_count_trg
AFTER INSERT OR UPDATE OR DELETE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.community_replies_count_fn();

-- ─── Trigger : updated_at sur posts et replies ──────────────────────────

CREATE OR REPLACE FUNCTION public.community_set_updated_at_fn() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_posts_updated_at_trg ON public.community_posts;
CREATE TRIGGER community_posts_updated_at_trg
BEFORE UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_set_updated_at_fn();

DROP TRIGGER IF EXISTS community_replies_updated_at_trg ON public.community_replies;
CREATE TRIGGER community_replies_updated_at_trg
BEFORE UPDATE ON public.community_replies
FOR EACH ROW EXECUTE FUNCTION public.community_set_updated_at_fn();

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.community_posts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes   ENABLE ROW LEVEL SECURITY;

-- Posts : lecture publique des non-soft-delete
DROP POLICY IF EXISTS "Public read non-deleted posts" ON public.community_posts;
CREATE POLICY "Public read non-deleted posts" ON public.community_posts
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Authors read own deleted posts" ON public.community_posts;
CREATE POLICY "Authors read own deleted posts" ON public.community_posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated insert posts" ON public.community_posts;
CREATE POLICY "Authenticated insert posts" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors update own posts" ON public.community_posts;
CREATE POLICY "Authors update own posts" ON public.community_posts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors delete own posts" ON public.community_posts;
CREATE POLICY "Authors delete own posts" ON public.community_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Replies : mêmes règles que posts
DROP POLICY IF EXISTS "Public read non-deleted replies" ON public.community_replies;
CREATE POLICY "Public read non-deleted replies" ON public.community_replies
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Authors read own deleted replies" ON public.community_replies;
CREATE POLICY "Authors read own deleted replies" ON public.community_replies
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated insert replies" ON public.community_replies;
CREATE POLICY "Authenticated insert replies" ON public.community_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors update own replies" ON public.community_replies;
CREATE POLICY "Authors update own replies" ON public.community_replies
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors delete own replies" ON public.community_replies;
CREATE POLICY "Authors delete own replies" ON public.community_replies
  FOR DELETE USING (auth.uid() = user_id);

-- Likes : user-only (lecture + insert + delete)
DROP POLICY IF EXISTS "Public read likes" ON public.community_likes;
CREATE POLICY "Public read likes" ON public.community_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users insert own likes" ON public.community_likes;
CREATE POLICY "Users insert own likes" ON public.community_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own likes" ON public.community_likes;
CREATE POLICY "Users delete own likes" ON public.community_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ─── RPC anti-spam ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.community_can_post(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (
    SELECT COUNT(*) FROM public.community_posts
    WHERE user_id = uid
      AND created_at > now() - interval '1 day'
      AND deleted_at IS NULL
  ) < 5;
$$;

CREATE OR REPLACE FUNCTION public.community_can_reply(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (
    SELECT COUNT(*) FROM public.community_replies
    WHERE user_id = uid
      AND created_at > now() - interval '1 day'
      AND deleted_at IS NULL
  ) < 30;
$$;

GRANT EXECUTE ON FUNCTION public.community_can_post(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_can_reply(uuid) TO authenticated;
