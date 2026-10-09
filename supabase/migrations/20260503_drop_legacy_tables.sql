-- ============================================================
-- v3.3.12 — DROP des tables fantômes
-- ------------------------------------------------------------
-- Décision validée 2026-05-02 (cf. le plan de travail interne) :
--
--   • recipe_tags : créée le 1er mai (20260501_data_migration_v3.sql) mais
--     restée vide depuis. YAGNI — sera recréée si besoin futur.
--
--   • ingredient_nutrition : tentée le 29 avril (20260429_ingredient_nutrition.sql)
--     mais jamais réellement utilisée. La nutrition est consolidée en colonne
--     jsonb sur `ingredients` (cf. 20260503_extend_ingredients.sql).
--
-- Précautions :
--   • IF EXISTS pour rester idempotent (si déjà drop ailleurs)
--   • Vérification manuelle pré-application : `SELECT count(*)` sur les 2
--     tables doit retourner 0 (cf. SCHEMA.md procédure d'application)
-- ============================================================

DROP TABLE IF EXISTS public.recipe_tags;

DROP TABLE IF EXISTS public.ingredient_nutrition;
