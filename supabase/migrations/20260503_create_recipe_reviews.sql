-- ============================================================
-- v3.17.0 — Notation et commentaires sur les recettes
-- ------------------------------------------------------------
-- Une row par avis user/recette. Note (1-5 étoiles) obligatoire,
-- commentaire optionnel. Permet de noter les recettes officielles
-- et communautaires (pas ses propres customs).
--
-- RGPD :
--   • ON DELETE SET NULL sur user_id : à la suppression du compte,
--     les avis restent (préserve la moyenne) mais l'auteur devient
--     « Anonyme »
--   • Soft delete via deleted_at + deleted_by_admin (pattern community)
--   • RLS lecture publique des non-deleted, mutation owner-only
--   • UNIQUE (user_id, recipe_id) : 1 seule note par user par recette
--   • Étend support_tickets target_type avec 'recipe_review' pour
--     les signalements
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recipe_reviews (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipe_id       text        NOT NULL,
  recipe_source   text        NOT NULL CHECK (recipe_source IN ('base', 'community')),
  rating          smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            text        NULL CHECK (body IS NULL OR char_length(body) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL,
  deleted_by_admin boolean    NOT NULL DEFAULT false,
  UNIQUE (user_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_reviews_recipe
  ON public.recipe_reviews (recipe_id, recipe_source, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_reviews_user
  ON public.recipe_reviews (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── Trigger updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recipe_reviews_set_updated_at_fn()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_reviews_updated_at_trg ON public.recipe_reviews;
CREATE TRIGGER recipe_reviews_updated_at_trg
BEFORE UPDATE ON public.recipe_reviews
FOR EACH ROW EXECUTE FUNCTION public.recipe_reviews_set_updated_at_fn();

-- ─── RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.recipe_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read non-deleted reviews" ON public.recipe_reviews;
CREATE POLICY "Public read non-deleted reviews" ON public.recipe_reviews
  FOR SELECT USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "Authors read own deleted reviews" ON public.recipe_reviews;
CREATE POLICY "Authors read own deleted reviews" ON public.recipe_reviews
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated insert reviews" ON public.recipe_reviews;
CREATE POLICY "Authenticated insert reviews" ON public.recipe_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors update own reviews" ON public.recipe_reviews;
CREATE POLICY "Authors update own reviews" ON public.recipe_reviews
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_by_admin = false)
  WITH CHECK (auth.uid() = user_id AND deleted_by_admin = false);

DROP POLICY IF EXISTS "Authors delete own reviews" ON public.recipe_reviews;
CREATE POLICY "Authors delete own reviews" ON public.recipe_reviews
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Étend support_tickets target_type pour 'recipe_review' ────────────

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS chk_support_tickets_target_type;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT chk_support_tickets_target_type
  CHECK (target_type IS NULL OR target_type IN (
    'recipe', 'user', 'comment', 'ingredient',
    'community_post', 'community_reply', 'recipe_review'
  ));

COMMENT ON TABLE public.recipe_reviews IS
  'v3.17.0 — Notes (1-5) et commentaires sur les recettes officielles + communautaires. UNIQUE (user_id, recipe_id) pour empêcher les doublons.';
