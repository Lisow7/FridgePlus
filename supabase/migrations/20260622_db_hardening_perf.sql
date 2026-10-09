-- Hardening perf (advisors Supabase) — bas risque, comportement identique.
--
-- 1. auth_rls_initplan : `auth.uid()` etait re-evalue PAR LIGNE dans 2 policies.
--    Le wrapper `(select auth.uid())` le cache par requete (memes resultats).
ALTER POLICY stock_events_owner_all ON public.stock_events
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY ai_usage_log_admin_select ON public.ai_usage_log
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

-- 2. Index couvrants pour 2 cles etrangeres non indexees.
CREATE INDEX IF NOT EXISTS feature_flags_updated_by_idx
  ON public.feature_flags (updated_by);
CREATE INDEX IF NOT EXISTS recipe_imports_staging_resolved_by_idx
  ON public.recipe_imports_staging (resolved_by);
