-- ============================================================
-- v3.15.1 — Modération communauté (signalements + admin actions)
-- ------------------------------------------------------------
-- Étend la communauté livrée en v3.15.0 avec :
--
--   1. Champ `community_muted_until` sur profiles (mute du user pour
--      la communauté uniquement, sans le bannir du compte).
--   2. Champ `deleted_by_admin` sur posts/replies pour distinguer
--      les soft-delete admin des soft-delete auteur.
--   3. Extension du CHECK `target_type` de support_tickets pour
--      accepter 'community_post' et 'community_reply' (signalements
--      réutilisent le système de tickets existant).
--   4. Mise à jour des RPC anti-spam pour bloquer les users mutés.
--
-- RGPD :
--   • community_muted_until : timestamptz nullable, durée bornée par
--     l'app (max 1 an sauf bannissement permanent à 9999-12-31).
--   • deleted_by_admin : booléen, distingue auteur vs admin pour la
--     restauration (admin-deleted ne peut pas être restauré par l'auteur).
--   • Pas de PII supplémentaire stockée.
-- ============================================================

-- ─── 1. Mute communauté sur profiles ───────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_muted_until timestamptz;

COMMENT ON COLUMN public.profiles.community_muted_until IS
  'v3.15.1 — Mute du user pour la communauté uniquement (post/reply). NULL = pas muté. Date passée = mute expiré. 9999-12-31 = mute permanent.';

CREATE INDEX IF NOT EXISTS idx_profiles_community_muted
  ON public.profiles (community_muted_until)
  WHERE community_muted_until IS NOT NULL;

-- ─── 2. deleted_by_admin sur posts/replies ─────────────────────────────

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS deleted_by_admin boolean NOT NULL DEFAULT false;

ALTER TABLE public.community_replies
  ADD COLUMN IF NOT EXISTS deleted_by_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.community_posts.deleted_by_admin IS
  'v3.15.1 — Si true, soft-delete par admin. L''auteur ne peut pas restaurer (utiliser support).';
COMMENT ON COLUMN public.community_replies.deleted_by_admin IS
  'v3.15.1 — Idem community_posts.deleted_by_admin.';

-- ─── 3. Étendre CHECK target_type sur support_tickets ──────────────────

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS chk_support_tickets_target_type;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT chk_support_tickets_target_type
  CHECK (target_type IS NULL OR target_type IN (
    'recipe', 'user', 'comment', 'ingredient',
    'community_post', 'community_reply'
  ));

-- ─── 4. RPC anti-spam mises à jour : intègre le mute ───────────────────

CREATE OR REPLACE FUNCTION public.community_can_post(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    -- Pas muté (NULL ou date passée OK)
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid AND community_muted_until IS NOT NULL
        AND community_muted_until > now()
    )
    AND
    -- Quota 5 posts / 24h
    (SELECT COUNT(*) FROM public.community_posts
     WHERE user_id = uid
       AND created_at > now() - interval '1 day'
       AND deleted_at IS NULL) < 5;
$$;

CREATE OR REPLACE FUNCTION public.community_can_reply(uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = uid AND community_muted_until IS NOT NULL
        AND community_muted_until > now()
    )
    AND
    (SELECT COUNT(*) FROM public.community_replies
     WHERE user_id = uid
       AND created_at > now() - interval '1 day'
       AND deleted_at IS NULL) < 30;
$$;

-- ─── 5. RLS : auteur ne peut pas restaurer un soft-delete admin ────────
-- On limite la policy UPDATE de l'auteur pour ne pas écrire deleted_at=NULL
-- quand deleted_by_admin = true. L'admin peut, lui, tout faire via service_role.

DROP POLICY IF EXISTS "Authors update own posts" ON public.community_posts;
CREATE POLICY "Authors update own posts" ON public.community_posts
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_by_admin = false)
  WITH CHECK (auth.uid() = user_id AND deleted_by_admin = false);

DROP POLICY IF EXISTS "Authors update own replies" ON public.community_replies;
CREATE POLICY "Authors update own replies" ON public.community_replies
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_by_admin = false)
  WITH CHECK (auth.uid() = user_id AND deleted_by_admin = false);

-- ─── 6. Index pour le listing admin (focus sur les signalements) ───────

CREATE INDEX IF NOT EXISTS idx_community_posts_admin_deleted
  ON public.community_posts (deleted_by_admin, created_at DESC)
  WHERE deleted_by_admin = true;

-- ─── 7. RPC SECURITY DEFINER pour les actions admin ────────────────────
-- Ces fonctions bypass RLS (les policies UPDATE/DELETE auteur n'autorisent
-- pas un admin à modérer un post dont il n'est pas l'auteur). Elles
-- vérifient `is_admin = true` sur profiles avant d'agir.

CREATE OR REPLACE FUNCTION public.admin_community_soft_delete_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.community_posts
    SET deleted_at = now(), deleted_by_admin = true
    WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_community_hard_delete_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  -- Cascade automatique sur replies + likes via les FK
  DELETE FROM public.community_posts WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_community_soft_delete_reply(p_reply_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.community_replies
    SET deleted_at = now(), deleted_by_admin = true
    WHERE id = p_reply_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_community_set_mute(
  p_user_id uuid,
  p_until   timestamptz
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.profiles
    SET community_muted_until = p_until
    WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_community_soft_delete_post(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_hard_delete_post(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_soft_delete_reply(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_set_mute(uuid, timestamptz) TO authenticated;
