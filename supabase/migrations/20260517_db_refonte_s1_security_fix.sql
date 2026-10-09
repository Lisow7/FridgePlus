-- ============================================================
-- v0.16.x — Refonte BDD Sprint 1 — Hotfix Sécurité advisors ERROR + WARN
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings advisors : `project_db_advisors_findings_2026_05_17.md`
--
-- Objectif : éliminer les 2 ERROR sécu Supabase + revoke anon sur les 28
-- RPC SECURITY DEFINER pour réduire la surface d'attaque exposée via
-- /rest/v1/rpc/* (PostgREST).
--
-- ─── 2 ERROR éliminés ───────────────────────────────────────────────────────
-- 1. `auth_users_exposed` : la vue `public.inactive_accounts_to_warn` join
--    `auth.users` (email) → exposition possible via PostgREST.
-- 2. `security_definer_view` : même vue, `security_invoker=off` (set par la
--    migration v3.373.0 du 15 mai pour éviter un 500 PostgREST cross-schema)
--    fait que la vue contourne RLS du caller.
--
-- Solution : déplacer la vue dans un schéma `private` non exposé par
-- PostgREST. Future Edge Function `notify-inactive` (TODO post-launch
-- documenté dans `20260515_inactive_accounts_purge_v3_370_0.sql`) la lira
-- en `service_role` via SQL direct, pas via REST.
--
-- ─── 28 WARN `anon_security_definer_function_executable` éliminés ───────────
-- Les 28 RPC SECURITY DEFINER sont actuellement EXECUTABLE par `anon` (rôle
-- non-authentifié). Aucune n'est appelée en anon par le code app (vérifié
-- via grep src/). Revoke pour réduire la surface d'attaque.
-- ============================================================

-- ─── 1) Schéma privé pour les vues/objets non-exposés via PostgREST ─────────

CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS
  'Schéma interne pour vues/objets accédés UNIQUEMENT par service_role (Edge Functions, jobs cron). PostgREST n''expose pas ce schéma par défaut. Évite les advisors auth_users_exposed et security_definer_view.';

-- ─── 2) Déplacer la vue inactive_accounts_to_warn dans private ──────────────

ALTER VIEW public.inactive_accounts_to_warn SET SCHEMA private;

COMMENT ON VIEW private.inactive_accounts_to_warn IS
  'RGPD Art. 5.1.e — déplacée dans `private` le 2026-05-17 (refonte BDD S1) pour éliminer 2 advisors ERROR (auth_users_exposed + security_definer_view). Lue par future Edge Function `notify-inactive` via service_role direct SQL (PAS via PostgREST).';

-- ─── 3) REVOKE EXECUTE FROM anon sur les 28 RPC SECURITY DEFINER ────────────
-- Garde EXECUTE pour authenticated + service_role (rôles légitimes pour
-- chaque RPC — la vérification fine d'autorisation se fait à l'intérieur
-- de chaque fonction via is_admin() ou auth.uid()).

REVOKE EXECUTE ON FUNCTION public._reschedule_cron(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_community_hard_delete_post(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_community_set_mute(uuid, timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_community_soft_delete_post(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_community_soft_delete_reply(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_auth_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_hard_delete(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_soft_delete(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_send_notification(text, jsonb, jsonb, jsonb, uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.anonymize_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_shopping_lists_limit() FROM anon;
REVOKE EXECUTE ON FUNCTION public.clear_special_access_note(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.community_can_post(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.community_can_reply(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.count_recipe_references(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_custom_recipe_rgpd(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_comped_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_special_access(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_recipe_status_changed() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_recipe_submitted() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_reply() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_edit_approved_custom_recipe() FROM anon;
REVOKE EXECUTE ON FUNCTION public.promote_recipe_to_base(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_inactive_warning(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_special_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
