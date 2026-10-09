-- ============================================================
-- v3.3.12 — Tables maîtres : difficulty_types + meal_types
-- ------------------------------------------------------------
-- Référentiels éditables par l'admin pour la cohérence des recettes.
-- Pattern aligné sur diet_types / allergen_types / countries_master existants.
--
-- Décision E (cf. project_db_architecture_decisions.md) :
--   • difficulty_types et meal_types en BDD pour i18n auto + édition admin
--   • units restent en code (g/ml/piece, universels, pas user-facing)
-- ============================================================

-- ─── difficulty_types ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.difficulty_types (
  id          serial      PRIMARY KEY,
  key         text        NOT NULL UNIQUE,
  labels      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  color       text,
  sort_order  integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS difficulty_types_touch ON public.difficulty_types;
CREATE TRIGGER difficulty_types_touch
  BEFORE UPDATE ON public.difficulty_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.difficulty_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "difficulty_types_select_public" ON public.difficulty_types;
CREATE POLICY "difficulty_types_select_public"
  ON public.difficulty_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "difficulty_types_modify_admin" ON public.difficulty_types;
CREATE POLICY "difficulty_types_modify_admin"
  ON public.difficulty_types FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.difficulty_types (key, labels, color, sort_order) VALUES
  ('very-easy',
   '{"fr":"Très facile","en":"Very easy","es":"Muy fácil","de":"Sehr einfach","ja":"とても簡単"}'::jsonb,
   '#7BB078', 1),
  ('easy',
   '{"fr":"Facile","en":"Easy","es":"Fácil","de":"Einfach","ja":"簡単"}'::jsonb,
   '#5B9AAE', 2),
  ('medium',
   '{"fr":"Intermédiaire","en":"Intermediate","es":"Intermedio","de":"Mittelschwer","ja":"中級"}'::jsonb,
   '#C4A555', 3),
  ('hard',
   '{"fr":"Difficile","en":"Difficult","es":"Difícil","de":"Schwer","ja":"難しい"}'::jsonb,
   '#D07070', 4)
ON CONFLICT (key) DO NOTHING;

-- ─── meal_types ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meal_types (
  id          serial      PRIMARY KEY,
  key         text        NOT NULL UNIQUE,
  labels      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  icon        text,
  bg_color    text,
  text_color  text,
  sort_order  integer     DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS meal_types_touch ON public.meal_types;
CREATE TRIGGER meal_types_touch
  BEFORE UPDATE ON public.meal_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.meal_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_types_select_public" ON public.meal_types;
CREATE POLICY "meal_types_select_public"
  ON public.meal_types FOR SELECT USING (true);

DROP POLICY IF EXISTS "meal_types_modify_admin" ON public.meal_types;
CREATE POLICY "meal_types_modify_admin"
  ON public.meal_types FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed avec les 5 types historiques + alias 'starter'/'side'/'salad' utilisés dans le code.
-- Note : les recettes existantes utilisent les valeurs 'main', 'starter', 'side', 'dessert', 'salad'
-- (cf. recipeConstants.js et CHECK actuel sur base_recipes.type).
INSERT INTO public.meal_types (key, labels, icon, bg_color, text_color, sort_order) VALUES
  ('starter',
   '{"fr":"Entrée & Soupe","en":"Starter & Soup","es":"Entrante y sopa","de":"Vorspeise & Suppe","ja":"前菜・スープ"}'::jsonb,
   '🥣', '#E3F0F7', '#3A7A9C', 1),
  ('main',
   '{"fr":"Plat principal","en":"Main course","es":"Plato principal","de":"Hauptgericht","ja":"メインディッシュ"}'::jsonb,
   '🍽️', '#FEF3E2', '#C47820', 2),
  ('side',
   '{"fr":"Accompagnement","en":"Side dish","es":"Guarnición","de":"Beilage","ja":"付け合わせ"}'::jsonb,
   '🥗', '#EDF7ED', '#4A8A48', 3),
  ('salad',
   '{"fr":"Salade","en":"Salad","es":"Ensalada","de":"Salat","ja":"サラダ"}'::jsonb,
   '🥙', '#E8F5E9', '#3A7A58', 4),
  ('dessert',
   '{"fr":"Dessert & Petit déjeuner","en":"Dessert & Breakfast","es":"Postre y desayuno","de":"Dessert & Frühstück","ja":"デザート・朝食"}'::jsonb,
   '🍰', '#F7EDF7', '#8A4A8A', 5)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.difficulty_types IS
  'Référentiel des niveaux de difficulté de recettes (4 rows). Édition réservée admin.';
COMMENT ON TABLE public.meal_types IS
  'Référentiel des types de plats (5 rows). Édition réservée admin.';
