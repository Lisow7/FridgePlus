-- Fix data : `vg-avocat` n'existe pas dans public.ingredients (l'id reel est
-- `fr-avocat`). 4 recettes le referencaient -> l'avocat n'y matchait jamais.
-- Remplacement cible (idempotent : no-op si plus aucun vg-avocat).
UPDATE public.recipes_unified
SET ingredients = REPLACE(ingredients::text, 'vg-avocat', 'fr-avocat')::jsonb
WHERE ingredients::text LIKE '%vg-avocat%';
