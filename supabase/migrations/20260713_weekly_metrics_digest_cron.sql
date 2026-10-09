-- supabase/migrations/20260713_weekly_metrics_digest_cron.sql
-- Cron hebdomadaire vers send-weekly-metrics-digest. Réutilise les
-- secrets Vault déjà créés pour les crons push (push_project_url,
-- push_cron_secret) — même profil de secret (cron interne, pas d'appel
-- navigateur), pas besoin d'en créer de nouveaux.

SELECT public._reschedule_cron(
  'send_weekly_metrics_digest',
  '0 8 * * 1',  -- chaque lundi 08:00 UTC
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_project_url') || '/functions/v1/send-weekly-metrics-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) AS request_id;
  $$
);
