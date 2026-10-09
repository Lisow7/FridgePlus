-- 2026-10-08 — Deux fonctions d'accès spécial que plus rien n'appelle ne
-- s'exécutent plus depuis le navigateur.
-- Audit du 2026-10-04, ADM-13 : `grant_comped_access` (l'ancien « Premium
-- offert ») et `clear_special_access_note` n'ont plus d'appelant — leurs
-- enveloppes JS (`adminGrantCompedAccess`, `adminClearSpecialAccessNote`) sont
-- retirées au lot 12c ; effacer une note passe désormais par
-- `grant_special_access` (note vide). Elles vérifient le rôle admin, mais une
-- fonction privilégiée sans usage n'a pas à rester appelable par tout compte.
--
-- ═════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- Retire le droit d'exécution de ces deux fonctions à PUBLIC, `anon` et
-- `authenticated`. Rien n'est supprimé : `service_role` les garde, et le
-- retour arrière est un GRANT.
--
-- Retour arrière :
--   GRANT EXECUTE ON FUNCTION public.grant_comped_access(uuid, text) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.clear_special_access_note(uuid) TO authenticated;
--
-- Sonde : supabase/probes/20261008_acces_special_sans_fonctions_mortes.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

REVOKE EXECUTE ON FUNCTION public.grant_comped_access(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_special_access_note(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;
