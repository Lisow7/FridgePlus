-- v3.166.3 — Profil communauté : bloquer + signaler
--
--   1. Table community_blocks : un user peut masquer tous les contenus
--      d'un autre user dans le feed et la vue détail.
--      Auto-block interdit (CHECK user_id != blocked_user_id).
--      RLS : user voit/insert/delete uniquement ses propres rows.
--
--   2. Extension du CHECK `target_type` de support_tickets pour
--      accepter 'community_profile' (signalement de profil).

-- ─── 1. Table community_blocks ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_blocks (
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CONSTRAINT chk_community_blocks_no_self CHECK (user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_blocks_user ON public.community_blocks(user_id);

COMMENT ON TABLE public.community_blocks IS
  'v3.166.3 — Liste des utilisateurs bloqués par chaque user. Filtrage côté client : les contenus des bloqués sont masqués dans le feed et la vue détail.';

-- ─── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_blocks_select_own ON public.community_blocks;
CREATE POLICY community_blocks_select_own ON public.community_blocks
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS community_blocks_insert_own ON public.community_blocks;
CREATE POLICY community_blocks_insert_own ON public.community_blocks
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS community_blocks_delete_own ON public.community_blocks;
CREATE POLICY community_blocks_delete_own ON public.community_blocks
  FOR DELETE USING (user_id = auth.uid());

-- ─── 2. Étendre CHECK target_type sur support_tickets ──────────────────

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS chk_support_tickets_target_type;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT chk_support_tickets_target_type
  CHECK (target_type IS NULL OR target_type IN (
    'recipe', 'user', 'comment', 'ingredient',
    'community_post', 'community_reply', 'community_profile'
  ));
