-- 2026-10-08 — Les deux tâches nocturnes sur les comptes écrivent leurs échecs
-- au journal d'activité.
-- Relecture du 2026-10-08 : en traitant chaque compte à part,
-- `anonymisation_qui_tient` et `comptes_jamais_confirmes` avaient rendu leurs
-- échecs SILENCIEUX — un `RAISE WARNING` ou un simple `NULL`, que pg_cron ne
-- garde nulle part : la tâche se disait réussie chaque nuit. L'audit (BDD-06)
-- demandait au contraire de pouvoir la surveiller.
--
-- ═════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. `private.anonymiser_les_comptes_supprimes()` : un compte qui résiste laisse
--    une ligne `account_anonymization_failed` au journal d'activité (le compte,
--    le code SQL, le message tronqué), lisible dans l'onglet Journal de l'admin.
-- 2. `private.effacer_les_comptes_jamais_confirmes()` : un compte qu'une
--    contrainte garde laisse une ligne `unconfirmed_account_kept` (même
--    contenu). Tout échec est attrapé, pas seulement `foreign_key_violation` :
--    un refus RESTRICT peut lever un autre code, et il arrêtait alors toute la
--    tâche.
--
-- Rien d'autre ne change : mêmes conditions, mêmes tâches, mêmes droits.
--
-- Retour arrière : remettre les deux fonctions de 20261008_anonymisation_qui_tient.sql
-- et de 20261008_comptes_jamais_confirmes.sql.
--
-- Sonde : supabase/probes/20261008_echecs_des_taches_au_journal.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION private.anonymiser_les_comptes_supprimes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
DECLARE
  v_profil record;
  v_faits integer := 0;
BEGIN
  FOR v_profil IN
    SELECT id
      FROM public.profiles
     WHERE deleted_at IS NOT NULL
       AND deleted_at < now() - interval '30 days'
       AND username !~ '^suppr-[0-9a-f]{14}$'
       AND username <> 'utilisateur-supprimé'
  LOOP
    BEGIN
      PERFORM private.anonymiser_le_compte(v_profil.id, NULL);
      v_faits := v_faits + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Un compte qui résiste ne bloque plus les autres, et le journal le dit.
      INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
      VALUES (NULL, 'account_anonymization_failed', v_profil.id::text, 'user',
              jsonb_build_object('sqlstate', SQLSTATE, 'message', left(SQLERRM, 200)));
    END;
  END LOOP;
  RETURN v_faits;
END;
$fonction$;

REVOKE ALL ON FUNCTION private.anonymiser_les_comptes_supprimes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.effacer_les_comptes_jamais_confirmes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
DECLARE
  v_compte record;
  v_effaces integer := 0;
BEGIN
  FOR v_compte IN
    SELECT u.id
      FROM auth.users u
     WHERE u.email_confirmed_at IS NULL
       AND u.last_sign_in_at IS NULL
       AND u.created_at < now() - interval '30 days'
       AND NOT EXISTS (SELECT 1 FROM public.user_stock x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.user_favorites x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.user_leftovers x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.shopping_lists x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.basket_items x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.cooking_logs x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.support_tickets x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.shared_baskets x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.spending_events x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.stock_events x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.community_posts x WHERE x.user_id = u.id)
       AND NOT EXISTS (SELECT 1 FROM public.community_replies x WHERE x.user_id = u.id)
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_compte.id;
      v_effaces := v_effaces + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Une contrainte s'y oppose : ce compte reste, les autres continuent, et
      -- le journal le dit.
      INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
      VALUES (NULL, 'unconfirmed_account_kept', v_compte.id::text, 'user',
              jsonb_build_object('sqlstate', SQLSTATE, 'message', left(SQLERRM, 200)));
    END;
  END LOOP;
  RETURN v_effaces;
END;
$fonction$;

REVOKE ALL ON FUNCTION private.effacer_les_comptes_jamais_confirmes() FROM PUBLIC, anon, authenticated;

COMMIT;
