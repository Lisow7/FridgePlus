-- 2026-10-08 — Basculer une fonctionnalité en production laisse une ligne au
-- journal d'activité, écrite par la base elle-même.
-- Audit du 2026-10-04, ADM-04 : un drapeau (`feature_flags.enabled`) agit tout
-- de suite pour tous les visiteurs, et sa bascule ne laissait aucune trace :
-- personne ne pouvait dire qui avait coupé quoi, ni quand. ADM-06 recommande
-- d'écrire le journal côté base plutôt que dans le navigateur : un déclencheur
-- voit toute bascule, d'où qu'elle vienne (panneau admin, éditeur SQL).
--
-- ═════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- `private.journaliser_la_bascule()` + le déclencheur `trg_journaliser_la_bascule`
-- (AFTER UPDATE OF enabled, seulement si l'état change) : une ligne
-- `feature_flag_toggled` au journal, avec le compte qui a basculé (NULL depuis
-- l'éditeur SQL), la clé du drapeau et son nouvel état.
--
-- Pas de trace pour une création : les drapeaux naissent par migration, et le
-- panneau n'en crée pas.
--
-- Retour arrière : `DROP TRIGGER trg_journaliser_la_bascule ON public.feature_flags`
-- puis `DROP FUNCTION private.journaliser_la_bascule()`.
--
-- Sonde : supabase/probes/20261008_bascules_au_journal.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

CREATE OR REPLACE FUNCTION private.journaliser_la_bascule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fonction$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES ((SELECT auth.uid()), 'feature_flag_toggled', NEW.key, 'feature_flag',
          jsonb_build_object('enabled', NEW.enabled));
  RETURN NULL;
END;
$fonction$;

REVOKE ALL ON FUNCTION private.journaliser_la_bascule() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_journaliser_la_bascule
  AFTER UPDATE OF enabled ON public.feature_flags
  FOR EACH ROW
  WHEN (OLD.enabled IS DISTINCT FROM NEW.enabled)
  EXECUTE FUNCTION private.journaliser_la_bascule();

COMMIT;
