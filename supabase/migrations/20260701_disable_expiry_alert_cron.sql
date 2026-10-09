-- Chantier 2b — coupe les alertes de péremption des INGRÉDIENTS : la DLC est
-- retirée des ingrédients (gardée pour les restes). On DÉSACTIVE le job pg_cron
-- (réversible : re-schedulable). La fonction public.notify_stock_expiry_run() et
-- la colonne user_stock.expiry_alert_stage sont CONSERVÉES (drop différé, non
-- destructeur).
SELECT cron.unschedule('notify_stock_expiry');
