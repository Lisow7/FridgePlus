-- Ajoute la colonne `allergen_prefs` sur `profiles` si elle n'existe pas.
-- C'est normalement fait par la migration V5 nutrition (20260429_ingredient_nutrition.sql),
-- mais cette migration ciblée garantit la présence du champ même si la grande
-- migration nutrition n'a jamais été appliquée — sinon l'enregistrement des
-- préférences allergènes depuis « Mon profil » renvoie un 400 PostgREST.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS allergen_prefs TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_allergen_prefs
  ON public.profiles USING GIN (allergen_prefs);

COMMENT ON COLUMN public.profiles.allergen_prefs IS
  'Allergènes déclarés par l''utilisateur (clés courtes : gluten, milk, eggs…). Filtre les recettes contenant ces allergènes.';
