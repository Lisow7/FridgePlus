-- ============================================================
-- v3.3.12 — Table maître : ingredient_subcategories
-- ------------------------------------------------------------
-- Référentiel des sous-catégories d'ingrédients (frozen-meat, vegetables…)
-- avec labels multilingues et couleurs UI. Décision C (cf.
-- project_db_architecture_decisions.md).
--
-- Source des seeds :
--   • Labels 5 langues : src/data/fridgeLayouts.js
--   • Couleurs (bg + text) : src/data/subcategoryColors.js
--
-- Permet à l'admin de :
--   • Renommer / retraduire sans toucher au code
--   • Ajouter une nouvelle sous-catégorie via le panel admin (Sprint 6)
--
-- La PR 1 inclut un seed complet (FK applicable directement). Si une
-- sous-catégorie présente dans `ingredients.subcategory` manque au seed,
-- un INSERT fallback la crée avec un label par défaut = la key elle-même
-- pour ne pas bloquer la FK.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ingredient_subcategories (
  key             text        PRIMARY KEY,
  labels          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  emoji           text,
  bg_color        text,
  text_color      text,
  storage_prefix  text,
  sort_order      integer     DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

DROP TRIGGER IF EXISTS ingredient_subcategories_touch ON public.ingredient_subcategories;
CREATE TRIGGER ingredient_subcategories_touch
  BEFORE UPDATE ON public.ingredient_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.ingredient_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingredient_subcategories_select_public" ON public.ingredient_subcategories;
CREATE POLICY "ingredient_subcategories_select_public"
  ON public.ingredient_subcategories FOR SELECT USING (true);

DROP POLICY IF EXISTS "ingredient_subcategories_modify_admin" ON public.ingredient_subcategories;
CREATE POLICY "ingredient_subcategories_modify_admin"
  ON public.ingredient_subcategories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── Seed des sous-catégories connues (depuis fridgeLayouts.js + subcategoryColors.js)

INSERT INTO public.ingredient_subcategories (key, labels, emoji, bg_color, text_color, storage_prefix, sort_order) VALUES
  -- Congélateur (frz)
  ('frozen-meat',
   '{"fr":"Viande congelée","en":"Frozen Meat","es":"Carne congelada","de":"Gefrierfleisch","ja":"冷凍肉"}'::jsonb,
   '🥩', '#FAE8E8', '#B83030', 'frz', 10),
  ('frozen-fish',
   '{"fr":"Poisson congelé","en":"Frozen Fish","es":"Pescado congelado","de":"Gefrierfisch","ja":"冷凍魚"}'::jsonb,
   '🐟', '#E8F4F8', '#5B9AAE', 'frz', 11),
  ('frozen-veg',
   '{"fr":"Légumes congelés","en":"Frozen Veggies","es":"Verduras congeladas","de":"Tiefkühlgemüse","ja":"冷凍野菜"}'::jsonb,
   '🥦', '#EEF6E8', '#5A8A28', 'frz', 12),
  ('frozen-bread',
   '{"fr":"Pain & Viennoiseries","en":"Frozen Bread & Pastries","es":"Pan & Bollería","de":"Tiefkühlbrot & Gebäck","ja":"冷凍パン・菓子パン"}'::jsonb,
   '🥐', '#F5EFE0', '#9A7840', 'frz', 13),
  ('ready-meals',
   '{"fr":"Plats préparés","en":"Ready Meals","es":"Platos preparados","de":"Fertiggerichte","ja":"冷凍食品"}'::jsonb,
   '🍕', '#EEF2F5', '#7A90A0', 'frz', 14),
  ('ice-cream',
   '{"fr":"Glaces","en":"Ice Cream","es":"Helados","de":"Eis & Eiscreme","ja":"アイスクリーム"}'::jsonb,
   '🍨', '#F2EEF8', '#8A68C0', 'frz', 15),

  -- Frais (fr)
  ('meat',
   '{"fr":"Viande","en":"Meat","es":"Carne","de":"Fleisch","ja":"肉類"}'::jsonb,
   '🥩', '#FAE8E8', '#B83030', 'fr', 20),
  ('fish',
   '{"fr":"Poisson","en":"Fish","es":"Pescado","de":"Fisch","ja":"魚介類"}'::jsonb,
   '🐟', '#E8F4F8', '#5B9AAE', 'fr', 21),
  ('bof',
   '{"fr":"Œufs, Beurre, Fromage","en":"Dairy & Eggs","es":"Lácteos & Huevos","de":"Milch & Eier","ja":"乳製品・卵"}'::jsonb,
   '🧀', '#FEF3DC', '#A88020', 'fr', 22),
  ('deli',
   '{"fr":"Charcuterie","en":"Deli","es":"Embutidos","de":"Wurst","ja":"加工肉・ハム"}'::jsonb,
   '🥓', '#F5E0EB', '#B84070', 'fr', 23),
  ('tofu',
   '{"fr":"Tofu & Légumineuses","en":"Tofu & Pulses","es":"Tofu & Legumbres","de":"Tofu & Hülsenfrüchte","ja":"豆腐・納豆"}'::jsonb,
   '🫘', '#F5F2E5', '#7A6B40', 'fr', 24),
  ('eggs',
   '{"fr":"Œufs","en":"Eggs","es":"Huevos","de":"Eier","ja":"卵"}'::jsonb,
   '🥚', '#FEF8E0', '#B89A20', 'fr', 25),
  ('cheese',
   '{"fr":"Fromages","en":"Cheese","es":"Quesos","de":"Käse","ja":"チーズ"}'::jsonb,
   '🧀', '#FEF3DC', '#A88020', 'fr', 26),
  ('dairy',
   '{"fr":"Produits laitiers","en":"Dairy","es":"Lácteos","de":"Milchprodukte","ja":"乳製品"}'::jsonb,
   '🥛', '#FEF3DC', '#A88020', 'fr', 27),

  -- Légumes / Fruits (vg)
  ('vegetables',
   '{"fr":"Légumes","en":"Vegetables","es":"Verduras","de":"Gemüse","ja":"野菜"}'::jsonb,
   '🥦', '#EEF6E8', '#5A8A28', 'vg', 30),
  ('fruits',
   '{"fr":"Fruits","en":"Fruits","es":"Frutas","de":"Obst","ja":"果物"}'::jsonb,
   '🍎', '#E8F5E9', '#6DAA6A', 'vg', 31),
  ('herbs',
   '{"fr":"Herbes aromatiques","en":"Herbs","es":"Hierbas","de":"Kräuter","ja":"ハーブ"}'::jsonb,
   '🌿', '#EEF6E8', '#5A8A28', 'vg', 32),

  -- Épicerie (gp)
  ('pasta-rice',
   '{"fr":"Pâtes & Riz","en":"Pasta & Rice","es":"Pasta & Arroz","de":"Nudeln & Reis","ja":"パスタ・米"}'::jsonb,
   '🍝', '#F5EFE0', '#9A7840', 'gp', 40),
  ('rice',
   '{"fr":"Riz & Nouilles","en":"Rice & Noodles","es":"Arroz & Fideos","de":"Reis & Nudeln","ja":"米・麺類"}'::jsonb,
   '🍚', '#F7F3E8', '#8A7040', 'gp', 41),
  ('canned',
   '{"fr":"Conserves","en":"Canned Goods","es":"Conservas","de":"Konserven","ja":"缶詰"}'::jsonb,
   '🥫', '#F5EFE0', '#9A7840', 'gp', 42),
  ('cereals',
   '{"fr":"Céréales & Légumineuses","en":"Cereals & Pulses","es":"Cereales","de":"Getreide & Hülsenfrüchte","ja":"穀物・豆"}'::jsonb,
   '🌾', '#F5EFE0', '#9A7840', 'gp', 43),
  ('bread',
   '{"fr":"Pain & Biscottes","en":"Bread & Crackers","es":"Pan & Galletas","de":"Brot & Knäckebrot","ja":"パン・クラッカー"}'::jsonb,
   '🍞', '#F5EFE0', '#9A7840', 'bk', 44),
  ('sweet',
   '{"fr":"Chocolat & Confiseries","en":"Chocolate & Sweets","es":"Chocolate & Dulces","de":"Schokolade & Süßigkeiten","ja":"お菓子・チョコ"}'::jsonb,
   '🍫', '#F5EFE0', '#9A7840', 'gp', 45),
  ('nuts-dried',
   '{"fr":"Noix & Fruits secs","en":"Nuts & Dried Fruits","es":"Frutos secos","de":"Nüsse & Trockenfrüchte","ja":"ナッツ・ドライフルーツ"}'::jsonb,
   '🥜', '#F5EFE0', '#9A7840', 'gp', 46),
  ('dry',
   '{"fr":"Produits secs","en":"Dry Goods","es":"Secos","de":"Trockenwaren","ja":"乾物"}'::jsonb,
   '🌾', '#F0EAD8', '#7A6030', 'gp', 47),

  -- Épices & Condiments (sp)
  ('salt-spices',
   '{"fr":"Sel & Épices","en":"Salt & Spices","es":"Sal & Especias","de":"Salz & Gewürze","ja":"塩・スパイス"}'::jsonb,
   '🧂', '#FBF0E4', '#C0601A', 'sp', 50),
  ('basic',
   '{"fr":"Assaisonnements de base","en":"Basic Seasonings","es":"Condimentos básicos","de":"Grundgewürze","ja":"基本調味料"}'::jsonb,
   '🧂', '#FBF0E4', '#C0601A', 'sp', 51),
  ('sauces',
   '{"fr":"Sauces & Condiments","en":"Sauces","es":"Salsas","de":"Soßen","ja":"ソース類"}'::jsonb,
   '🫙', '#FBF0E4', '#C0601A', 'sp', 52),
  ('oils',
   '{"fr":"Huiles & Vinaigres","en":"Oils & Vinegars","es":"Aceites & Vinagres","de":"Öle & Essig","ja":"油・酢"}'::jsonb,
   '🫒', '#FBF0E4', '#C0601A', 'sp', 53)
ON CONFLICT (key) DO NOTHING;

-- ─── Filet de sécurité : seeder toute key utilisée par ingredients qui manquerait
-- Évite l'échec FK si une sous-catégorie a été oubliée du seed manuel.
INSERT INTO public.ingredient_subcategories (key, labels, sort_order)
SELECT DISTINCT
  i.subcategory,
  jsonb_build_object('fr', i.subcategory),
  999
FROM public.ingredients i
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredient_subcategories WHERE key = i.subcategory
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.ingredient_subcategories IS
  'Référentiel des sous-catégories d''ingrédients (frigo + congélateur + placard). Labels multilingues. Édition réservée admin.';
