-- Anti-gaspi 1C — planification quotidienne (08:00 UTC, de-correle des purges 03:00).
SELECT public._reschedule_cron(
  'notify_stock_expiry',
  '0 8 * * *',
  $$SELECT public.notify_stock_expiry_run();$$
);
