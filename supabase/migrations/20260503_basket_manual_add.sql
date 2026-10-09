-- ============================================================
-- v3.27.1 — Ajout manuel d'ingrédients au panier (hors recette)
-- ------------------------------------------------------------
-- Pour permettre à l'utilisateur d'ajouter un ingrédient au panier
-- sans qu'il vienne d'une recette précise (ex : « Lait », « Œufs »
-- ajoutés directement depuis la barre de recherche du panier),
-- on rend les colonnes `recipe_id`, `recipe_name`, `recipe_emoji`
-- nullables dans `basket_items`.
--
-- Côté code :
--   • addBasketItems peut désormais insérer des rows avec recipe_id NULL
--   • loadBasketFromDB renvoie ces rows comme tous les autres
--   • Côté ShoppingCartPanel :
--       - section « À acheter » : les items manuels apparaissent comme
--         les autres (consolidés par ingredient_id)
--       - section « Détail par recette » : les items manuels sont
--         filtrés (cohérent — pas de recette à afficher)
--
-- Cascade DELETE inchangée (encore via user_id ON DELETE CASCADE),
-- aucun impact RGPD : suppression de compte continue à effacer les
-- items manuels comme les autres.
-- ============================================================

ALTER TABLE public.basket_items
  ALTER COLUMN recipe_id    DROP NOT NULL,
  ALTER COLUMN recipe_name  DROP NOT NULL,
  ALTER COLUMN recipe_emoji DROP NOT NULL;

-- Le foreign key sur recipe_id (basket_items_recipe_id_fkey) reste en
-- place mais accepte désormais NULL (PostgREST/PostgreSQL n'enforce la
-- FK que pour les valeurs non-null). Pas besoin de la modifier.

COMMENT ON COLUMN public.basket_items.recipe_id IS
  'NULL = ajout manuel hors recette (v3.27.1). Sinon, FK vers la recette source.';
