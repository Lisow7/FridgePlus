-- ============================================================
-- v3.6.1 — pg_cron : purges automatiques RGPD
-- ------------------------------------------------------------
-- Active l'extension pg_cron + planifie 3 jobs nocturnes pour respecter
-- les durées de conservation décidées dans project_rgpd_compliance.md.
--
-- Conventions :
--   • Tous les jobs tournent à des heures différentes (évite la contention)
--   • Tous en UTC (pg_cron par défaut)
--   • Idempotents : DELETE ne plante pas si rien à supprimer
--   • Jobs créés via cron.schedule(jobname, schedule, command).
--     Le job_name unique permet de re-runner cette migration sans dupliquer.
--
-- Pour voir les jobs actifs : SELECT * FROM cron.job;
-- Pour voir les exécutions : SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- Pour désactiver un job : SELECT cron.unschedule('job_name');
-- ============================================================

-- ─── Activer extension pg_cron (si pas déjà activée par Supabase) ───────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA cron;

-- ─── Helper : (re)planifier un job en remplaçant l'ancien ────────────────────
-- pg_cron ne supporte pas CREATE OR REPLACE pour les jobs ; on unschedule
-- silencieusement avant de re-schedule pour rester idempotent.

CREATE OR REPLACE FUNCTION public._reschedule_cron(p_jobname text, p_schedule text, p_command text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
BEGIN
  -- Désinscription silencieuse (no-op si le job n'existe pas)
  PERFORM cron.unschedule(p_jobname) FROM cron.job WHERE jobname = p_jobname;
  -- Inscription
  PERFORM cron.schedule(p_jobname, p_schedule, p_command);
END;
$$;

-- ─── Job 1 : Purge notifications expirées (quotidien 03:00 UTC) ─────────────
-- Les notifications ont expires_at = now() + 90 days par défaut. On purge
-- celles qui sont dans le passé. Couvre les non-lues anciennes.
SELECT public._reschedule_cron(
  'purge_expired_notifications',
  '0 3 * * *',
  $$DELETE FROM public.notifications WHERE expires_at < now();$$
);

-- ─── Job 2 : Purge notifications lues > 6 mois (quotidien 03:15 UTC) ────────
-- Pour les notifications lues, on raccourcit la durée à 6 mois (pas besoin
-- de garder une notif lue pendant 90 jours après son expiration).
SELECT public._reschedule_cron(
  'purge_read_notifications',
  '15 3 * * *',
  $$DELETE FROM public.notifications WHERE read_at IS NOT NULL AND read_at < now() - interval '6 months';$$
);

-- ─── Job 3 : Purge tickets support résolus > 24 mois (hebdo dimanche 04:00) ──
-- Les tickets résolus restent 24 mois (RGPD : preuve de réclamation),
-- au-delà ils sont purgés. La conversation (support_messages) est CASCADE
-- DELETE via la FK ticket_id.
SELECT public._reschedule_cron(
  'purge_old_resolved_tickets',
  '0 4 * * 0',
  $$DELETE FROM public.support_tickets WHERE status = 'resolved' AND updated_at < now() - interval '24 months';$$
);

-- ─── Job 4 : Anonymisation des comptes soft-deleted > 30j (quotidien 03:30) ──
-- Appelle anonymize_user() pour chaque profile dont deleted_at est dépassé.
-- Note : ne fait PAS le hard-delete (qui nécessite auth.admin via Edge
-- Function). Cf. PR v3.6.2 pour le hard-delete via Edge Function.
SELECT public._reschedule_cron(
  'anonymize_soft_deleted_profiles',
  '30 3 * * *',
  $$DO $do$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT id FROM public.profiles
        WHERE deleted_at IS NOT NULL
          AND deleted_at < now() - interval '30 days'
          AND username <> 'utilisateur-supprimé'
      LOOP
        PERFORM public.anonymize_user(r.id);
      END LOOP;
    END
  $do$;$$
);

COMMENT ON FUNCTION public._reschedule_cron(text, text, text) IS
  'v3.6.1 — Helper interne pour (re)planifier un job pg_cron de façon idempotente. Utilisé par les migrations cron.';
