-- 20260617 — Hardening : security_invoker sur la vue ai_usage_daily_summary.
-- ----------------------------------------------------------------------
-- La vue d'agrégats de coûts AI était en SECURITY DEFINER (advisor ERROR
-- security_definer_view) → elle contournait la RLS de ai_usage_log.
-- En security_invoker, la RLS admin-only (ai_usage_log_admin_select :
-- profiles.role='admin') s'applique : seul un admin voit les stats, un
-- non-admin voit une vue vide. Comportement voulu, aucune fuite.
--
-- Déjà appliqué en prod + vérifié par re-scan advisors (0 ERROR sécurité).
-- Idempotent.

ALTER VIEW public.ai_usage_daily_summary SET (security_invoker = true);
