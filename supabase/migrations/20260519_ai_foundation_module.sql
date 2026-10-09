-- ────────────────────────────────────────────────────────────────────────────
-- AI Foundation Module — PR IA-1
-- Tables : ai_usage_log (tracking + budget guard) + ai_cache (déduplication)
-- + Fonction get_monthly_ai_cost() pour budget hard-stop
-- + RLS strict (admin only)
-- + Retention 90j auto via pg_cron
-- ────────────────────────────────────────────────────────────────────────────

-- 1. ai_usage_log : log toutes les calls OpenAI (cost tracking + RGPD audit)
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,            -- 'moderation' | 'substitute' | 'describe' | 'image' | 'recipe-import'
  model text NOT NULL,              -- 'gpt-4o-mini' | 'gpt-image-1' | 'omni-moderation' | etc.
  prompt_tokens int,
  completion_tokens int,
  cost_cents int NOT NULL DEFAULT 0,  -- en centimes pour éviter float drift
  cached boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb  -- libre : item_id, request_id, etc.
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature_created ON ai_usage_log (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_user_id ON ai_usage_log (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Lecture admin uniquement
CREATE POLICY ai_usage_log_admin_select ON ai_usage_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Aucune écriture client (passe forcément par Edge Function ou script service_role)
-- → Pas de policy INSERT/UPDATE/DELETE pour authenticated, seul service_role contourne.

-- 2. ai_cache : déduplication prompts (clé = sha256(prompt+model))
CREATE TABLE IF NOT EXISTS ai_cache (
  cache_key text PRIMARY KEY,                       -- sha256(prompt + ':' + model)
  feature text NOT NULL,
  model text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  hit_count int NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_last_hit ON ai_cache (last_hit_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature ON ai_cache (feature);

ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- Lecture publique (les responses cachées sont déjà servies via Edge Function/RPC)
CREATE POLICY ai_cache_public_select ON ai_cache
  FOR SELECT TO authenticated, anon
  USING (true);

-- Écriture service_role uniquement (pas de policy → bloqué par défaut hors service_role)

-- 3. Fonction de calcul du coût mensuel cumulé
CREATE OR REPLACE FUNCTION get_monthly_ai_cost_cents()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(cost_cents), 0)::int
  FROM ai_usage_log
  WHERE created_at >= date_trunc('month', now())
$$;

-- 4. Vue admin : coûts par feature/jour pour dashboard
CREATE OR REPLACE VIEW ai_usage_daily_summary AS
SELECT
  date_trunc('day', created_at)::date AS day,
  feature,
  model,
  COUNT(*) AS calls,
  SUM(cost_cents) AS cost_cents,
  SUM(CASE WHEN cached THEN 1 ELSE 0 END) AS cache_hits,
  ROUND(100.0 * SUM(CASE WHEN cached THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1) AS cache_hit_rate
FROM ai_usage_log
GROUP BY day, feature, model
ORDER BY day DESC, feature, model;

GRANT SELECT ON ai_usage_daily_summary TO authenticated;

-- 5. Job pg_cron : retention 90 jours pour ai_usage_log (RGPD)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ai_usage_log_retention_90d',
      '0 3 * * *',
      $cron$ DELETE FROM ai_usage_log WHERE created_at < now() - interval '90 days' $cron$
    );
    -- Cache : purge entries non touchées depuis 180j (économie storage)
    PERFORM cron.schedule(
      'ai_cache_cleanup_180d',
      '0 4 * * *',
      $cron$ DELETE FROM ai_cache WHERE last_hit_at < now() - interval '180 days' $cron$
    );
  END IF;
END $$;

COMMENT ON TABLE ai_usage_log IS 'Tracking calls OpenAI : cost, feature, model, user. Retention 90j RGPD.';
COMMENT ON TABLE ai_cache IS 'Cache déduplication prompts → response. Clé sha256(prompt+model).';
COMMENT ON FUNCTION get_monthly_ai_cost_cents() IS 'Coût IA cumulé du mois en cours (centimes). Utilisé par budget-guard.';
