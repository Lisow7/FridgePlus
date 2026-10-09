-- ============================================================
-- Fix : Edge Function `notify-inactive` renvoyait 500 depuis 2 mois
-- ------------------------------------------------------------
-- Root cause : la migration 20260517_db_refonte_s1_security_fix.sql a
-- deplace la vue `inactive_accounts_to_warn` de `public` vers `private`
-- (pour ne plus l'exposer via PostgREST, cf. advisors auth_users_exposed
-- + security_definer_view). Son propre commentaire annoncait deja le
-- correctif necessaire ("Future Edge Function notify-inactive... la lira
-- en service_role via SQL direct, pas via REST") mais l'Edge Function
-- elle-meme n'a jamais ete mise a jour : elle continue d'appeler
-- `.from('inactive_accounts_to_warn')`, qui passe par PostgREST et ne
-- voit que le schema `public` -> "relation does not exist" -> 500 a
-- chaque execution du cron depuis le 17 mai.
--
-- Solution : meme pattern que les 28 RPC SECURITY DEFINER deja en place
-- (cf. 20260517_db_refonte_s1_security_fix.sql / 20260518_..._revoke_...).
-- Une fonction RPC dans `public` lit la vue privee en SECURITY DEFINER,
-- reste appelable via PostgREST (`/rest/v1/rpc/...`) mais REVOKE de
-- anon/authenticated/PUBLIC -> seul service_role (bypass RLS/grants)
-- peut l'appeler, donc uniquement l'Edge Function cron.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_inactive_accounts_to_warn()
RETURNS TABLE(id uuid, username text, language text, last_login_at timestamptz, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT id, username, language, last_login_at, email
  FROM private.inactive_accounts_to_warn;
$$;

COMMENT ON FUNCTION public.get_inactive_accounts_to_warn() IS
  'RGPD Art. 5.1.e — Wrapper SECURITY DEFINER pour lire private.inactive_accounts_to_warn via PostgREST (le schema private n''est pas expose directement). Appelee uniquement par l''Edge Function notify-inactive (service_role) — cf. 20260517_db_refonte_s1_security_fix.sql pour le contexte du deplacement de la vue.';

REVOKE EXECUTE ON FUNCTION public.get_inactive_accounts_to_warn() FROM anon, authenticated, PUBLIC;
