-- ============================================================
-- v0.16.x — Refonte BDD Sprint 7c — REVOKE EXECUTE sur SECURITY DEFINER RPCs
-- ------------------------------------------------------------
-- Ferme l'exposition de TOUTES les fonctions SECURITY DEFINER au rôle anon.
-- État avant : 17 fonctions exécutables par anon. État après : 0.
--
-- Principe défense en profondeur (pattern Supabase 2026) :
--   1. RPC SECURITY DEFINER s'exécute avec les privilèges du propriétaire.
--      Les checks internes `is_admin()` / `auth.uid() = X` restent l'ultime
--      garde-fou contre une mauvaise autorisation.
--   2. MAIS PostgreSQL grant EXECUTE à PUBLIC par défaut sur toute
--      function, donc anon (rôle non authentifié, exposé via
--      /rest/v1/rpc/<name>) peut appeler chacune sans check préalable.
--      anon échoue toujours le check is_admin() ou auth.uid(), mais on
--      dépense un round-trip et on expose une surface d'attaque inutile.
--   3. REVOKE EXECUTE FROM PUBLIC coupe la racine. Les grants explicites
--      à `authenticated` (admins ou users connectés) restent actifs.
--      `service_role` garde aussi son grant explicite (bypass RLS total).
--
-- ⚠️ Subtilité critique : `REVOKE FROM anon` est un NO-OP si PUBLIC a
-- toujours le grant (anon hérite via PUBLIC). Pattern correct :
-- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;`
--
-- Catégorisation (28 SECURITY DEFINER functions) :
--
--   A) Trigger functions (6) — REVOKE FROM anon, authenticated, PUBLIC
--      Appelées par triggers BD, jamais via REST. Aucune raison qu'elles
--      soient exécutables comme RPC. Réduit la surface.
--
--   B) Admin-only RPCs (9) — REVOKE FROM PUBLIC
--      Le check is_admin() interne reste actif pour les admins
--      authentifiés. service_role bypass (utilisé par jobs pg_cron).
--
--   C) User-facing RPCs (8) — REVOKE FROM PUBLIC
--      Appelées par utilisateurs connectés via supabase-js. Check
--      auth.uid() interne reste actif. anon n'a jamais à les appeler.
--
--   D) Déjà revoked dans PRs précédentes (5) — REVOKE idempotent ici
--      pour homogénéité du fichier migration.
--
-- Note advisor : Le lint `authenticated_security_definer_function_executable`
-- reste flaggé pour les RPC légitimement appelables par authenticated. C'est
-- intentionnel — l'advisor demande de réfléchir, pas de fermer aveuglément.
-- Cette PR cible uniquement `anon_security_definer_function_executable`
-- (-25 WARN).
-- ============================================================

BEGIN;

-- ─── A) Trigger functions — REVOKE total (jamais via REST) ─────────────────

REVOKE EXECUTE ON FUNCTION public.check_shopping_lists_limit()         FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_recipe_status_changed()       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_recipe_submitted()            FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_ticket_reply()                FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_edit_approved_recipe()       FROM anon, authenticated, PUBLIC;

-- ─── B) Admin-only RPCs — REVOKE FROM PUBLIC ───────────────────────────────

REVOKE EXECUTE ON FUNCTION public._reschedule_cron(text, text, text)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_community_hard_delete_post(uuid)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_community_set_mute(uuid, timestamptz)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_community_soft_delete_post(uuid)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_community_soft_delete_reply(uuid)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_auth_users()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_review_hard_delete(uuid)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_review_soft_delete(uuid)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.promote_recipe_to_base(text)                       FROM PUBLIC;

-- ─── C) User-facing RPCs — REVOKE FROM PUBLIC ──────────────────────────────

REVOKE EXECUTE ON FUNCTION public.anonymize_user(uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.community_can_post(uuid)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.community_can_reply(uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.count_recipe_references(text)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_custom_recipe_rgpd(text)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin()                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_inactive_warning(uuid)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                   FROM PUBLIC;

-- ─── D) Déjà revoked dans PRs précédentes — idempotent ici pour homogénéité

REVOKE EXECUTE ON FUNCTION public.admin_send_notification(text, jsonb, jsonb, jsonb, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clear_special_access_note(uuid)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_comped_access(uuid, text)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_special_access(uuid, text, text)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_special_access(uuid)             FROM PUBLIC;

COMMIT;
