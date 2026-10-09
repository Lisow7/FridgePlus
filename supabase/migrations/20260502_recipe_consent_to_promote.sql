-- Consentement à la promotion de recette communautaire
-- ----------------------------------------------------------------------
-- Quand un user crée une recette qu'il publie en ligne (moderation_status
-- pending), on lui demande son consentement explicite pour qu'on puisse
-- la "promouvoir" plus tard en recette officielle (base_recipes) avec
-- son nom comme crédit (RGPD : consentement éclairé).
--
-- Sans ce consent, l'admin ne pourra pas promouvoir la recette même si
-- elle est approuvée.
--
-- Idempotent.

ALTER TABLE public.custom_recipes
  ADD COLUMN IF NOT EXISTS consent_to_promote boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.custom_recipes.consent_to_promote IS
  'L''auteur a explicitement consenti à ce que sa recette puisse être promue par l''équipe en recette officielle, avec son nom comme crédit. Doit être true pour autoriser la promotion. RGPD Art.7 (consentement éclairé).';
