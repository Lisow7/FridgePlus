-- ════════════════════════════════════════════════════════════════════════
-- Notifications push — cron quotidien vers send-push-notification
-- ════════════════════════════════════════════════════════════════════════
-- Pas de précédent pg_net dans ce repo (notify-inactive n'est pas encore
-- automatisé) — nouvelle brique, pattern officiel Supabase (pg_cron + pg_net
-- + Vault pour ne jamais committer de secret en clair dans une migration).

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Les 2 valeurs réelles sont injectées séparément (pas dans ce fichier
-- committé) via :
--   select vault.create_secret('https://bymuvgjghtupfzwjbice.supabase.co', 'push_project_url');
--   select vault.create_secret('<SEND_PUSH_CRON_SECRET réel>', 'push_cron_secret');
-- Idempotence : si les secrets existent déjà (ré-application de la
-- migration), `vault.create_secret` lève une erreur de nom dupliqué — c'est
-- volontaire, on ne veut PAS écraser un secret existant depuis une
-- migration ; gérer la création à la main une seule fois via le SQL Editor.

SELECT public._reschedule_cron(
  'send_push_notifications',
  '0 9 * * *',  -- quotidien 09:00 UTC (créneau libre : autres jobs à 03:00/03:45/04:00/08:00)
  $$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_project_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'push_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) AS request_id;
  $$
);
