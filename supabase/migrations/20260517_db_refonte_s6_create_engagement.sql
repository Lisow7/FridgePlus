-- ============================================================
-- v0.16.x — Refonte BDD Sprint 6 — Create engagement Exclusive Arc (PR-DB-14)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Objectif Sprint 6 : fusionner 4 tables de réactions/engagement
-- (community_likes, community_reply_likes, post_reactions, recipe_reviews)
-- en une seule table `engagement` avec pattern Exclusive Arc.
--
-- PR-DB-14 (cette migration) — Création + seed snapshot, SQL-only :
--   - CREATE TABLE engagement avec Exclusive Arc
--     (CHECK num_nonnulls(target_post_id, target_reply_id, target_recipe_id) = 1)
--   - 4 shape constraints (1 par type) pour garantir cohérence emoji/rating/body
--   - RLS conforme Sprint 1 (select public + own, write own + admin)
--   - SEED 17 rows : 3 post_likes + 2 reply_likes + 11 reactions + 1 review
--   - 4 partial indexes pour perf lookup par target
--
-- Pattern Exclusive Arc (cf. findings web 2026) > polymorphic associations :
-- FK garanties, intégrité référentielle préservée, perf > polymorphic.
--
-- ⚠️ Les 4 anciennes tables restent SOURCE DE VÉRITÉ pour les writes app
-- jusqu'à PR-DB-16. PR-DB-15 (à venir) ajoute les sync triggers.
-- ============================================================

BEGIN;

-- ─── 1) Table engagement avec Exclusive Arc ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.engagement (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type              text NOT NULL,

  -- ─── Exclusive Arc : exactement 1 des 3 targets non-null ─────
  target_post_id    uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  target_reply_id   uuid REFERENCES public.community_replies(id) ON DELETE CASCADE,
  target_recipe_id  text REFERENCES public.recipes_unified(id) ON DELETE CASCADE,

  -- ─── Métadonnées selon type ─────
  emoji             text,
  rating            smallint,
  body              text,

  -- ─── Soft delete (recipe_reviews) ─────
  deleted_at        timestamptz,
  deleted_by_admin  boolean NOT NULL DEFAULT false,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- ─── Contraintes ─────
  CONSTRAINT engagement_type_check
    CHECK (type IN ('post_like', 'reply_like', 'reaction', 'review')),

  CONSTRAINT engagement_exclusive_arc
    CHECK (num_nonnulls(target_post_id, target_reply_id, target_recipe_id) = 1),

  CONSTRAINT engagement_rating_range
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),

  -- Shape checks par type (garantit cohérence target/metadata)
  CONSTRAINT engagement_post_like_shape CHECK (
    type != 'post_like' OR (
      target_post_id IS NOT NULL AND emoji IS NULL AND rating IS NULL AND body IS NULL
    )
  ),
  CONSTRAINT engagement_reply_like_shape CHECK (
    type != 'reply_like' OR (
      target_reply_id IS NOT NULL AND emoji IS NULL AND rating IS NULL AND body IS NULL
    )
  ),
  CONSTRAINT engagement_reaction_shape CHECK (
    type != 'reaction' OR (
      target_post_id IS NOT NULL AND emoji IS NOT NULL AND rating IS NULL AND body IS NULL
    )
  ),
  CONSTRAINT engagement_review_shape CHECK (
    type != 'review' OR (
      target_recipe_id IS NOT NULL AND rating IS NOT NULL AND emoji IS NULL
    )
  )
);

COMMENT ON TABLE public.engagement IS
  'Fusion 4 tables réactions/engagement (community_likes + community_reply_likes + post_reactions + recipe_reviews). Refonte BDD Sprint 6. Pattern Exclusive Arc : 1 row = 1 target sur 3 possibles (post/reply/recipe). 4 shape checks garantissent cohérence type ↔ target ↔ metadata.';
COMMENT ON COLUMN public.engagement.type IS
  'post_like (like sur post community), reply_like (like sur reply), reaction (emoji sur post), review (note 1-5 + body sur recipe)';

-- ─── 2) Indexes partial par target (perf lookup) ─────────────────────────────
-- Likes/reactions sur posts → query "tous les likes/reactions d'un post"
CREATE INDEX IF NOT EXISTS engagement_target_post_idx
  ON public.engagement(target_post_id)
  WHERE target_post_id IS NOT NULL;

-- Likes sur replies
CREATE INDEX IF NOT EXISTS engagement_target_reply_idx
  ON public.engagement(target_reply_id)
  WHERE target_reply_id IS NOT NULL;

-- Reviews sur recipes
CREATE INDEX IF NOT EXISTS engagement_target_recipe_idx
  ON public.engagement(target_recipe_id)
  WHERE target_recipe_id IS NOT NULL;

-- Profil user (mes likes/reactions/reviews)
CREATE INDEX IF NOT EXISTS engagement_user_type_idx
  ON public.engagement(user_id, type);

-- ─── 3) Trigger updated_at ───────────────────────────────────────────────────
CREATE TRIGGER engagement_touch_updated_at
  BEFORE UPDATE ON public.engagement
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─── 4) RLS conforme Sprint 1 ────────────────────────────────────────────────
ALTER TABLE public.engagement ENABLE ROW LEVEL SECURITY;

-- SELECT public : likes/reactions posts publics + reviews recipes publics
-- (les drafts community sont protégés par RLS de community_posts en cascade)
CREATE POLICY engagement_select_public ON public.engagement
  AS PERMISSIVE FOR SELECT TO public
  USING (deleted_at IS NULL);

-- SELECT own (drafts inclus)
CREATE POLICY engagement_select_own ON public.engagement
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- SELECT admin
CREATE POLICY engagement_select_admin ON public.engagement
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (is_admin());

-- INSERT own (user_id = auth.uid())
CREATE POLICY engagement_insert_own ON public.engagement
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- UPDATE own (pour reviews : éditer body/rating)
CREATE POLICY engagement_update_own ON public.engagement
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id AND deleted_at IS NULL)
  WITH CHECK ((select auth.uid()) = user_id);

-- DELETE own
CREATE POLICY engagement_delete_own ON public.engagement
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- Admin all (soft-delete reviews via UPDATE deleted_by_admin)
CREATE POLICY engagement_update_admin ON public.engagement
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY engagement_delete_admin ON public.engagement
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

-- ─── 5) SEED 17 rows depuis les 4 sources ────────────────────────────────────

-- 5a) post_likes (3 rows attendus)
INSERT INTO public.engagement (user_id, type, target_post_id, created_at)
SELECT user_id, 'post_like', post_id, created_at
FROM public.community_likes;

-- 5b) reply_likes (2 rows attendus)
INSERT INTO public.engagement (user_id, type, target_reply_id, created_at)
SELECT user_id, 'reply_like', reply_id, created_at
FROM public.community_reply_likes;

-- 5c) reactions (11 rows attendus, avec emoji)
INSERT INTO public.engagement (user_id, type, target_post_id, emoji, created_at)
SELECT user_id, 'reaction', post_id, emoji, COALESCE(created_at, now())
FROM public.post_reactions;

-- 5d) reviews (1 row attendu, garde son id uuid pour stabilité externe)
INSERT INTO public.engagement (
  id, user_id, type, target_recipe_id, rating, body,
  deleted_at, deleted_by_admin, created_at, updated_at
)
SELECT
  id, user_id, 'review', recipe_id, rating, body,
  deleted_at, deleted_by_admin, created_at, updated_at
FROM public.recipe_reviews;

COMMIT;
