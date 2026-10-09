-- v3.164.0 — Réactions émoji sur les posts communauté
-- Remplace le système de like binaire par 5 émojis (❤️ 😋 🔥 😮 👏).
-- likes_count reste la source de vérité pour le tri et l'affichage total.

CREATE TABLE IF NOT EXISTS post_reactions (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (emoji IN ('❤️','😋','🔥','😮','👏')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON post_reactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reactions_insert" ON post_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_update" ON post_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete" ON post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Migration des likes existants en ❤️
INSERT INTO post_reactions (user_id, post_id, emoji, created_at)
SELECT user_id, post_id, '❤️', created_at FROM community_likes
ON CONFLICT (user_id, post_id) DO NOTHING;
