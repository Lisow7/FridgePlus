-- ============================================================
-- V3 — Migration complète des données vers la BDD
-- Source unique de vérité : Supabase. Plus de fichiers JS statiques
-- (sauf changelog qui reste versionné dans le code).
--
-- Étend base_recipes + ingredients, et crée les tables master
-- pour les régimes/allergènes/pays/layouts/tags.
-- ============================================================

-- ─── Fonction utilitaire (idempotente) ───────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── ÉTENDRE base_recipes ─────────────────────────────────────

-- Description multilingue (jsonb : {"fr": "...", "en": "...", ...})
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS description jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allergènes dérivés des ingrédients (texte[], ex: ['gluten','milk'])
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}';

-- URL d'image pour la recette (Supabase Storage ou externe). Optionnel.
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS image_url text;

-- Temps préparation et cuisson séparés (NULL = utiliser time_min global)
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS prep_time_min integer;
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS cook_time_min integer;

-- Statut éditorial : draft / published / featured
ALTER TABLE base_recipes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
ALTER TABLE base_recipes
  DROP CONSTRAINT IF EXISTS base_recipes_status_check;
ALTER TABLE base_recipes
  ADD CONSTRAINT base_recipes_status_check
    CHECK (status IN ('draft', 'published', 'featured'));

-- Convertir steps de text[] (unilingue) à jsonb (multilingue par langue).
-- Format cible : {"fr": ["étape 1", "étape 2"], "en": [...], ...}
-- Comme tous les steps actuels sont vides (migrate-to-db v1 les a mis à []),
-- on peut DROP et recréer sans perdre de données.
ALTER TABLE base_recipes DROP COLUMN IF EXISTS steps;
ALTER TABLE base_recipes ADD COLUMN steps jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index GIN pour requêtes sur allergens
CREATE INDEX IF NOT EXISTS idx_base_recipes_allergens
  ON base_recipes USING GIN (allergens);

-- ─── ÉTENDRE ingredients ─────────────────────────────────────

-- Prix grande surface par région (jsonb : {"fr": 1.00, "en": 0.88, ...})
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS price jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── TABLE diet_types (master) ───────────────────────────────

CREATE TABLE IF NOT EXISTS diet_types (
  id           serial PRIMARY KEY,
  key          text NOT NULL UNIQUE,        -- 'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'halal'
  labels       jsonb NOT NULL DEFAULT '{}', -- {"fr": "Végétarien", "en": "Vegetarian", ...}
  color        text,                        -- couleur texte du badge (ex: #065f46)
  bg_color     text,                        -- couleur fond du badge (ex: #d1fae5)
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE diet_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diet_types_select_public" ON diet_types;
CREATE POLICY "diet_types_select_public"
  ON diet_types FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "diet_types_modify_admin" ON diet_types;
CREATE POLICY "diet_types_modify_admin"
  ON diet_types FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── TABLE allergen_types (master) ───────────────────────────

CREATE TABLE IF NOT EXISTS allergen_types (
  id           serial PRIMARY KEY,
  key          text NOT NULL UNIQUE,        -- 'gluten', 'milk', 'nuts', 'fish', etc.
  labels       jsonb NOT NULL DEFAULT '{}', -- {"fr": "Gluten", "en": "Gluten", ...}
  icon         text,                        -- emoji (ex: '🌾' pour gluten)
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE allergen_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allergen_types_select_public" ON allergen_types;
CREATE POLICY "allergen_types_select_public"
  ON allergen_types FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "allergen_types_modify_admin" ON allergen_types;
CREATE POLICY "allergen_types_modify_admin"
  ON allergen_types FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── TABLE countries_master ──────────────────────────────────

CREATE TABLE IF NOT EXISTS countries_master (
  code         text PRIMARY KEY,            -- 'fr', 'it', 'us', 'ma', 'in', 'th', 'lb', 'intl'
  names        jsonb NOT NULL DEFAULT '{}', -- {"fr": "France", "en": "France", ...}
  flag         text,                        -- emoji drapeau
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE countries_master ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "countries_master_select_public" ON countries_master;
CREATE POLICY "countries_master_select_public"
  ON countries_master FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "countries_master_modify_admin" ON countries_master;
CREATE POLICY "countries_master_modify_admin"
  ON countries_master FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── TABLE recipe_tags (m:n flexible) ────────────────────────

CREATE TABLE IF NOT EXISTS recipe_tags (
  recipe_id    text NOT NULL REFERENCES base_recipes(id) ON DELETE CASCADE,
  tag          text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (recipe_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag);

ALTER TABLE recipe_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipe_tags_select_public" ON recipe_tags;
CREATE POLICY "recipe_tags_select_public"
  ON recipe_tags FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "recipe_tags_modify_admin" ON recipe_tags;
CREATE POLICY "recipe_tags_modify_admin"
  ON recipe_tags FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── TABLE fridge_layouts ────────────────────────────────────

CREATE TABLE IF NOT EXISTS fridge_layouts (
  language     text PRIMARY KEY,            -- 'fr', 'en', 'es', 'de', 'ja'
  structure    jsonb NOT NULL,              -- objet complet du layout (compartiments, sections, labels)
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS fridge_layouts_touch ON fridge_layouts;
CREATE TRIGGER fridge_layouts_touch
  BEFORE UPDATE ON fridge_layouts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

ALTER TABLE fridge_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fridge_layouts_select_public" ON fridge_layouts;
CREATE POLICY "fridge_layouts_select_public"
  ON fridge_layouts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "fridge_layouts_modify_admin" ON fridge_layouts;
CREATE POLICY "fridge_layouts_modify_admin"
  ON fridge_layouts FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- Note : les données seront insérées via le script
-- scripts/migrate-to-db.mjs étendu (voir adapter dans la PR).
-- Cette migration crée seulement le schéma.
-- ============================================================
