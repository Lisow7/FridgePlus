-- ============================================================
-- v3.59.0 — Fix : recipe_id / recipe_name / recipe_emoji nullables
-- ------------------------------------------------------------
-- Problème observé en prod (logs Sentry/console) :
--   POST /rest/v1/basket_items 400 Bad Request
--   "null value in column \"recipe_id\" of relation \"basket_items\"
--    violates not-null constraint"
--
-- La migration `20260503_basket_manual_add.sql` (v3.27.1) avait déjà
-- droppé les contraintes NOT NULL pour permettre :
--   1. l'ajout manuel d'ingrédients hors recette (depuis la barre
--      de recherche du panier),
--   2. le chargement d'une liste sauvegardée (Phase L) — les items
--      d'une liste libre n'ont pas forcément de recette source.
--
-- Cette migration n'a manifestement pas été appliquée sur la BDD
-- distante (Supabase prod). On re-applique ici de manière
-- idempotente : DROP NOT NULL ne fait rien si la contrainte n'existe
-- déjà plus (pas d'erreur).
--
-- Cascade DELETE inchangée. RGPD inchangé.
-- ============================================================

ALTER TABLE public.basket_items
  ALTER COLUMN recipe_id    DROP NOT NULL,
  ALTER COLUMN recipe_name  DROP NOT NULL,
  ALTER COLUMN recipe_emoji DROP NOT NULL;

COMMENT ON COLUMN public.basket_items.recipe_id IS
  'NULL = ajout manuel hors recette OU item provenant d''une liste sauvegardée libre. Sinon, FK vers la recette source.';
