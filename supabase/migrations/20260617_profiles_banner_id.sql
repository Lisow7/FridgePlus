-- Personnalisation profil — bannière (chantier Quêtes & personnalisation, PR1).
-- Colonne optionnelle ; NULL = bannière par défaut (1re du catalogue).
-- Référence l'id d'une entrée de src/features/profile/data/banner-catalog.js
-- (catalogue statique, pas de FK). Affichée dans l'en-tête du profil public.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_id text;
COMMENT ON COLUMN public.profiles.banner_id IS 'Bannière de profil choisie (id du catalogue banner-catalog.js). NULL = bannière par défaut.';
