-- ============================================================
-- V5 — Nutrition & Allergènes
-- Table ingredient_nutrition + préférences allergènes profils
-- ============================================================

-- Table principale : valeurs nutritionnelles pour 100 g par ingrédient
CREATE TABLE IF NOT EXISTS ingredient_nutrition (
  ingredient_id   TEXT        PRIMARY KEY,  -- correspond aux IDs de src/data/ingredients.js
  calories_100g   NUMERIC(6,1),             -- kcal
  proteins_100g   NUMERIC(6,1),             -- g
  carbs_100g      NUMERIC(6,1),             -- g
  fat_100g        NUMERIC(6,1),             -- g
  fiber_100g      NUMERIC(6,1),             -- g
  allergens       TEXT[]      DEFAULT '{}', -- ex: ARRAY['gluten','milk']
  source          TEXT        CHECK (source IN ('openfoodfacts', 'web', 'manual')),
  verified        BOOLEAN     DEFAULT false,
  notes           TEXT,                     -- remarques libres (ex: "valeur approximative")
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes par allergène (opérateur @> ou &&)
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_allergens
  ON ingredient_nutrition USING GIN (allergens);

-- Trigger mise à jour automatique de updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ingredient_nutrition_updated_at ON ingredient_nutrition;
CREATE TRIGGER ingredient_nutrition_updated_at
  BEFORE UPDATE ON ingredient_nutrition
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE ingredient_nutrition ENABLE ROW LEVEL SECURITY;

-- Lecture publique (invité + connecté)
CREATE POLICY "nutrition_read_all"
  ON ingredient_nutrition FOR SELECT
  USING (true);

-- Écriture admin uniquement
CREATE POLICY "nutrition_admin_write"
  ON ingredient_nutrition FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- ── Préférences allergènes sur le profil utilisateur ─────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allergen_prefs TEXT[] DEFAULT '{}';

-- Index GIN pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_profiles_allergen_prefs
  ON profiles USING GIN (allergen_prefs);

-- ── Commentaires ─────────────────────────────────────────────
COMMENT ON TABLE ingredient_nutrition IS
  'Valeurs nutritionnelles (pour 100 g) et allergènes des ingrédients Fridge+. Source : Open Food Facts, sites de magasins, ou saisie manuelle.';

COMMENT ON COLUMN ingredient_nutrition.allergens IS
  '14 allergènes UE possibles : gluten, crustaceans, eggs, fish, peanuts, soybeans, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs';

COMMENT ON COLUMN profiles.allergen_prefs IS
  'Allergènes déclarés par l''utilisateur. Filtre les recettes contenant ces allergènes.';
