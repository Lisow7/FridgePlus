-- v3.165.0 — Partage de recette dans un post communauté
-- Ajoute recipe_id (TEXT) à community_posts.
-- Peut référencer une base_recipe (id string) ou une custom_recipe (UUID string).
-- NULL = post sans recette attachée.

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS recipe_id TEXT NULL;
