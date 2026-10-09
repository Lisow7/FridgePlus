-- ============================================================
-- v3.17.3 — Modération admin des avis recettes
-- ------------------------------------------------------------
-- RPC SECURITY DEFINER pour soft-delete admin (la policy UPDATE
-- standard ne laisse passer que l'auteur). Vérifie is_admin = true
-- sur profiles avant action. Cohérent avec admin_community_*.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_review_soft_delete(p_review_id uuid)
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
  UPDATE public.recipe_reviews
    SET deleted_at = now(), deleted_by_admin = true
    WHERE id = p_review_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_hard_delete(p_review_id uuid)
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
  DELETE FROM public.recipe_reviews WHERE id = p_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_soft_delete(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_hard_delete(uuid) TO authenticated;
