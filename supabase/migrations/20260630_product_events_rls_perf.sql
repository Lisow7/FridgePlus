-- Perf RLS (advisor auth_rls_initplan) : éviter de ré-évaluer auth.uid() par ligne.
-- `(select auth.uid())` est évalué une seule fois (initplan) au lieu de par-ligne.
-- Sémantique IDENTIQUE à la policy d'origine (20260630_product_events.sql) ; seule
-- l'optimisation d'évaluation change.
alter policy "insert own events" on public.product_events
  with check (user_id is null or user_id = (select auth.uid()));
