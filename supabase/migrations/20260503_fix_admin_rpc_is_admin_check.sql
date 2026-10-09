-- ============================================================
-- v3.24.4 — Fix : RPCs admin référencent profiles.is_admin (n'existe pas)
-- ------------------------------------------------------------
-- Les 6 RPCs admin créés par 20260503_community_moderation.sql et
-- 20260503_admin_review_moderation.sql faisaient
--   SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid()
-- mais la colonne `profiles.is_admin` n'existe pas — le rôle admin est
-- porté par `profiles.role = 'admin'`. Conséquence : tout appel à ces
-- RPCs (Soft/Hard delete post, Soft delete reply, Mute, Review soft/
-- hard delete) renvoyait `column "is_admin" does not exist`.
--
-- Correction : on remplace la lecture directe de la colonne par un appel
-- à la fonction `public.is_admin()` (créée dans 20260430_admin_rls_policies.sql),
-- qui matche le vrai schéma (`role = 'admin'`) et est SECURITY DEFINER
-- pour éviter la récursion RLS sur profiles.
--
-- Aucun changement de signature ni de comportement métier — uniquement
-- la vérification du rôle admin.
-- ============================================================

-- ─── Communauté ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_community_soft_delete_post(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
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
BEGIN
  IF NOT public.is_admin() THEN
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
BEGIN
  IF NOT public.is_admin() THEN
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.profiles
    SET community_muted_until = p_until
    WHERE id = p_user_id;
END;
$$;

-- ─── Avis recettes ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_review_soft_delete(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  UPDATE public.recipe_reviews
    SET deleted_at = now(), deleted_by_admin = true
    WHERE id = p_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_hard_delete(p_review_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only';
  END IF;
  DELETE FROM public.recipe_reviews WHERE id = p_review_id;
END;
$$;

-- ─── Grants (idempotents) ──────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.admin_community_soft_delete_post(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_hard_delete_post(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_soft_delete_reply(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_community_set_mute(uuid, timestamptz)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_soft_delete(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_hard_delete(uuid)                TO authenticated;
