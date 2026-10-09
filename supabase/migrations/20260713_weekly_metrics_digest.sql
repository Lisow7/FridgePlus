-- supabase/migrations/20260713_weekly_metrics_digest.sql
-- Digest métriques hebdomadaire — remplace le trigger verbal "check beta"
-- manuel par un calcul automatisé (cf. spec
-- 2026-07-12-beta-longue-sans-entite-design.md, partie B).
--
-- Reprend la même méthodologie que le runbook "check beta" manuel :
-- cohorte de la semaine (activation/favori/cuisiné) + cohorte 7-14 jours
-- (rétention J7), en excluant les comptes admin et supprimés.

CREATE OR REPLACE FUNCTION public.get_weekly_metrics_digest()
RETURNS TABLE(
  signups_last_7d bigint,
  activated_pct numeric,
  favorited_pct numeric,
  cooked_pct numeric,
  retention_cohort_size bigint,
  retention_j7_pct numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH new_cohort AS (
    SELECT
      p.id,
      EXISTS (SELECT 1 FROM public.user_stock s WHERE s.user_id = p.id) AS activated,
      EXISTS (SELECT 1 FROM public.user_favorites f WHERE f.user_id = p.id) AS favorited,
      EXISTS (SELECT 1 FROM public.cooking_logs c WHERE c.user_id = p.id) AS cooked
    FROM public.profiles p
    WHERE p.role <> 'admin'
      AND p.deleted_at IS NULL
      AND p.created_at >= now() - interval '7 days'
  ),
  retention_cohort AS (
    SELECT
      p.id,
      (p.last_login_at IS NOT NULL AND p.last_login_at >= p.created_at + interval '6 days') AS retained_j7
    FROM public.profiles p
    WHERE p.role <> 'admin'
      AND p.deleted_at IS NULL
      AND p.created_at >= now() - interval '14 days'
      AND p.created_at <  now() - interval '7 days'
  )
  SELECT
    (SELECT count(*) FROM new_cohort)::bigint,
    COALESCE(round(100.0 * (SELECT count(*) FILTER (WHERE activated) FROM new_cohort) / NULLIF((SELECT count(*) FROM new_cohort), 0), 1), 0),
    COALESCE(round(100.0 * (SELECT count(*) FILTER (WHERE favorited) FROM new_cohort) / NULLIF((SELECT count(*) FROM new_cohort), 0), 1), 0),
    COALESCE(round(100.0 * (SELECT count(*) FILTER (WHERE cooked) FROM new_cohort) / NULLIF((SELECT count(*) FROM new_cohort), 0), 1), 0),
    (SELECT count(*) FROM retention_cohort)::bigint,
    COALESCE(round(100.0 * (SELECT count(*) FILTER (WHERE retained_j7) FROM retention_cohort) / NULLIF((SELECT count(*) FROM retention_cohort), 0), 1), 0);
$$;

COMMENT ON FUNCTION public.get_weekly_metrics_digest() IS
  'Digest métriques hebdomadaire (activation/favori/cuisiné/rétention J7) — remplace le "check beta" manuel. Lue par l''Edge Function send-weekly-metrics-digest (service_role uniquement).';

REVOKE EXECUTE ON FUNCTION public.get_weekly_metrics_digest() FROM anon, authenticated, PUBLIC;
