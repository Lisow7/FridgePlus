-- Opposition au profilage tenue par la base (audit du 2026-10-04, RGPD-18 (a)).
--
-- Jusqu'ici, seule l'application vérifiait `profiles.profiling_opted_out`
-- avant d'insérer une dépense (RPC `is_profiling_opted_out`) ; si cette lecture
-- échouait, l'insertion partait quand même, et aucune règle de la base ne
-- lisait l'opposition. La règle d'insertion la lit désormais : une dépense
-- enregistrée contre l'opposition est refusée (42501), quoi que fasse le client.
--
-- `is_profiling_opted_out(uuid)` : SECURITY INVOKER, STABLE, lit la ligne
-- `profiles` du compte lui-même (lisible par lui sous RLS). `auth.uid()` sous
-- `(select …)` comme toutes les règles du dépôt (initplan, 2026-05-17).
--
-- Compatible avec la v0.145 en production : rien ne change pour qui ne s'est
-- pas opposé. Attend la confirmation d'Antoine (essai à blanc par la sonde
-- supabase/probes/20261009_opposition_au_profilage_en_base.sql, puis
-- apply_migration) — voir supabase/migrations/README.md.

DROP POLICY IF EXISTS spending_events_insert_own ON public.spending_events;
CREATE POLICY spending_events_insert_own ON public.spending_events
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    user_id = (select auth.uid())
    AND NOT public.is_profiling_opted_out((select auth.uid()))
  );
