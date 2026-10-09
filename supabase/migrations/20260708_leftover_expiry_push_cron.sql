-- supabase/migrations/20260708_leftover_expiry_push_cron.sql
-- Notifications push — cron quotidien vers send-leftover-expiry-push.
-- Réutilise les secrets Vault déjà créés en Phase 1 pour
-- send_push_notifications (push_project_url, push_cron_secret) : même
-- profil de secret (cron interne, pas d'appel navigateur), pas besoin d'en
-- créer de nouveaux.

SELECT public._reschedule_cron(
  'send_leftover_expiry_push',
  '15 9 * * *',  -- quotidien 09:15 UTC (juste après send_push_notifications à 09:00 ; libre : 03:00/03:15/03:30/03:45/04:00/08:00/09:00 déjà pris)
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_project_url') || '/functions/v1/send-leftover-expiry-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) AS request_id;
  $$
);
