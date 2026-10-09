-- Anti-gaspi 1B-i — événements de retrait du frigo (consommé/gaspillé) avec
-- estimations € et carbone, pour le score anti-gaspi. RLS owner-only. Idempotente.
CREATE TABLE IF NOT EXISTS public.stock_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_id text NOT NULL,
  removed_at    timestamptz NOT NULL DEFAULT now(),
  outcome       text NOT NULL CHECK (outcome IN ('consumed', 'wasted')),
  est_price_eur numeric,
  est_carbon_g  numeric
);

CREATE INDEX IF NOT EXISTS idx_stock_events_user_removed
  ON public.stock_events (user_id, removed_at DESC);

ALTER TABLE public.stock_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_events_owner_all" ON public.stock_events;
CREATE POLICY "stock_events_owner_all"
  ON public.stock_events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
