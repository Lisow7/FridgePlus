-- v3.166.0 — Profil communauté (bio)
-- Ajoute community_bio (TEXT, max 200 caractères) à profiles.
-- Texte libre que l'utilisateur affiche sur sa page profil communauté.
-- NULL = pas de bio renseignée.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS community_bio TEXT NULL;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_community_bio_length_chk;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_community_bio_length_chk
  CHECK (community_bio IS NULL OR char_length(community_bio) <= 200);

COMMENT ON COLUMN profiles.community_bio IS
  'Bio courte affichée sur le profil communauté (max 200 chars). v3.166.0';
