-- ============================================================
-- v3.373.0 — Sprint 10 S10.c.10b — Fix : inactive_accounts_to_warn invoker mode
-- ------------------------------------------------------------
-- La migration S10.c.8 avait posé la vue avec `security_invoker = on`,
-- pensant que le JWT service_role aurait accès aux colonnes de
-- `auth.users` via JOIN. En pratique, la combinaison vue cross-schema
-- (public + auth) + security_invoker + PostgREST renvoie un 500
-- côté Edge Function (`View read failed`).
--
-- Switch à `security_invoker = off` (default Postgres) :
--   - La requête interne de la vue s'exécute comme l'owner (postgres),
--     qui a full access à `profiles` ET `auth.users`.
--   - Le caller (service_role appelé par l'Edge Function) a juste besoin
--     de SELECT sur la vue elle-même (déjà accordé par défaut Supabase).
--   - PostgREST n'a plus à introspecter cross-schema → la requête passe.
--
-- ⚠️ Conséquence sécurité : la vue expose désormais des emails (auth.users.email)
-- à TOUT rôle ayant SELECT sur elle. Mitigation :
--   - REVOKE explicit anon + authenticated (pas censés y accéder)
--   - service_role uniquement (le seul caller légitime — Edge Function)
-- ============================================================

ALTER VIEW public.inactive_accounts_to_warn SET (security_invoker = off);

-- Sécurise les GRANTs : on retire anon + authenticated qui héritent par
-- défaut Supabase ; service_role reste (Edge Function).
REVOKE ALL ON public.inactive_accounts_to_warn FROM anon;
REVOKE ALL ON public.inactive_accounts_to_warn FROM authenticated;

COMMENT ON VIEW public.inactive_accounts_to_warn IS
  'RGPD Art. 5.1.e — Comptes inactifs > 3 ans à notifier. v3.373.0 : security_invoker=off + GRANTs durcis (service_role only). Lue par Edge Function `notify-inactive`.';
