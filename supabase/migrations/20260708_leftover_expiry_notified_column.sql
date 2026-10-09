-- supabase/migrations/20260708_leftover_expiry_notified_column.sql
-- Anti-répétition pour le rappel de péremption des restes (push + in-app).
-- Posée par send-leftover-expiry-push une fois un rappel envoyé pour ce
-- reste. expires_at est immuable après création (aucune fonction de mise
-- à jour n'existe côté client sur user_leftovers) : pas de mécanisme de
-- reset nécessaire.

ALTER TABLE public.user_leftovers
  ADD COLUMN IF NOT EXISTS expiry_notified_at timestamptz;

COMMENT ON COLUMN public.user_leftovers.expiry_notified_at IS
  'Anti-répétition : posé par send-leftover-expiry-push une fois un rappel (push+in-app) envoyé pour ce reste. expires_at étant immuable après création, aucun mécanisme de reset n''est nécessaire.';
