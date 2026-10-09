-- RLS append-only sur activity_logs
-- ----------------------------------------------------------------------
-- Contexte : la table `activity_logs` (alias « Journal » côté UI v3.3+)
-- enregistre chaque action admin pour traçabilité RGPD. Pour empêcher
-- qu'un admin malveillant efface ses traces, on impose append-only :
--
--   • SELECT : autorisé pour les admins (déjà en place via la migration
--     20260430_admin_rls_policies.sql)
--   • INSERT : autorisé pour les admins (logAdminAction côté code)
--   • UPDATE : INTERDIT pour tous, y compris admins
--   • DELETE : INTERDIT pour tous, y compris admins
--
-- Ainsi le journal ne peut être ni modifié ni effacé une fois inséré.
-- La rétention est gérée par un job pg_cron séparé (à mettre en place
-- pour purger les entrées > 12 mois selon la politique de conservation).
-- Idempotent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
  ) THEN
    -- Active RLS si pas déjà fait
    EXECUTE 'ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY';

    -- Policy INSERT : seuls les admins peuvent écrire (via logAdminAction)
    EXECUTE 'DROP POLICY IF EXISTS "activity_logs_insert_admin" ON public.activity_logs';
    EXECUTE 'CREATE POLICY "activity_logs_insert_admin"
      ON public.activity_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin())';

    -- Policy UPDATE : interdite — append-only strict.
    -- On crée une policy qui accepte ZÉRO ligne (USING false) ce qui
    -- bloque tout UPDATE même pour les admins.
    EXECUTE 'DROP POLICY IF EXISTS "activity_logs_no_update" ON public.activity_logs';
    EXECUTE 'CREATE POLICY "activity_logs_no_update"
      ON public.activity_logs
      FOR UPDATE
      TO authenticated
      USING (false)';

    -- Policy DELETE : interdite — append-only strict.
    EXECUTE 'DROP POLICY IF EXISTS "activity_logs_no_delete" ON public.activity_logs';
    EXECUTE 'CREATE POLICY "activity_logs_no_delete"
      ON public.activity_logs
      FOR DELETE
      TO authenticated
      USING (false)';

    -- Note : la policy SELECT existe déjà via 20260430_admin_rls_policies.sql
    -- (activity_logs_select_admin). On la laisse intacte.
  END IF;
END $$;

COMMENT ON TABLE public.activity_logs IS
  'Journal des actions admin — append-only. UPDATE et DELETE bloqués par RLS pour intégrité RGPD. Rétention 12 mois (purge via pg_cron — à venir).';
