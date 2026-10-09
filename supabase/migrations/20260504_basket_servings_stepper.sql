-- ============================================================
-- v3.27.4 — Stepper personnes par recette dans le panier
-- ------------------------------------------------------------
-- L'utilisateur peut désormais ajuster le nombre de personnes d'une
-- recette directement dans le panier (− / + dans la section
-- « Détail par recette »). Toutes les quantités des ingrédients de
-- cette recette se recalculent en proportion.
--
-- Pour persister cet ajustement entre sessions, on enrichit
-- `basket_items` avec 3 colonnes :
--   • `recipe_servings`         — nombre de personnes actuel choisi
--   • `recipe_servings_initial` — nombre de personnes au moment de
--                                 l'ajout (référence pour le ratio)
--   • `amount_initial`          — quantité au moment de l'ajout
--                                 (référence pour le ratio, évite le
--                                 drift d'arrondi sur des UPDATE
--                                 successifs)
--
-- Calcul au stepper : new_amount = amount_initial × current_servings
--                                / recipe_servings_initial
-- Idempotent au stepper, pas de drift.
--
-- Les colonnes sont nullables :
--   • Pour les items existants en BDD avant cette migration (legacy),
--     elles sont NULL → le stepper est masqué pour ces recettes (UI
--     affiche juste « X personnes » non cliquable).
--   • Pour les ajouts manuels (recipe_id NULL, cf. v3.27.1), elles
--     restent NULL aussi → pas de stepper sur ces items.
--
-- Cascade DELETE inchangée. Aucun impact RGPD : ces 3 colonnes sont
-- des données fonctionnelles utilisateur, supprimées avec son compte
-- comme le reste de basket_items.
-- ============================================================

ALTER TABLE public.basket_items
  ADD COLUMN IF NOT EXISTS recipe_servings         int,
  ADD COLUMN IF NOT EXISTS recipe_servings_initial int,
  ADD COLUMN IF NOT EXISTS amount_initial          numeric;

COMMENT ON COLUMN public.basket_items.recipe_servings IS
  'Nombre de personnes actuel choisi par l''utilisateur dans le panier (v3.27.4). NULL pour les ajouts manuels (recipe_id NULL) ou les items legacy.';
COMMENT ON COLUMN public.basket_items.recipe_servings_initial IS
  'Nombre de personnes au moment de l''ajout au panier (référence pour le calcul du ratio).';
COMMENT ON COLUMN public.basket_items.amount_initial IS
  'Quantité au moment de l''ajout au panier (référence pour le calcul du ratio, évite le drift d''arrondi).';
