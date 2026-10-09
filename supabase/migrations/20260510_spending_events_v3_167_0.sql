-- v3.167.0 — Analyse dépenses Premium
--
-- Table spending_events : un row par fois où l'user clique
-- "J'ai fait mes courses" (transfert panier → frigo).
-- Source des données pour le graphique mensuel + recommandations.
--
-- items_json : snapshot du contenu transféré pour analyses futures
-- (top catégories, IA LLM contextualisée — différé post-launch).
-- Aucune donnée personnelle (juste ids ingrédients + qty + unit_eur).

CREATE TABLE IF NOT EXISTS public.spending_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  total_eur     DECIMAL(10,2) NOT NULL CHECK (total_eur >= 0),
  items_count   INT NOT NULL CHECK (items_count >= 0),
  items_json    JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_spending_events_user_date
  ON public.spending_events(user_id, occurred_at DESC);

COMMENT ON TABLE public.spending_events IS
  'v3.167.0 — Snapshots de dépenses captés au transfert panier→frigo. Alimente le dashboard Analyse Dépenses Premium.';

-- ─── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.spending_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spending_events_select_own ON public.spending_events;
CREATE POLICY spending_events_select_own ON public.spending_events
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS spending_events_insert_own ON public.spending_events;
CREATE POLICY spending_events_insert_own ON public.spending_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS spending_events_delete_own ON public.spending_events;
CREATE POLICY spending_events_delete_own ON public.spending_events
  FOR DELETE USING (user_id = auth.uid());
