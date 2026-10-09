-- Ajoute la colonne country_code à profiles.
--
-- Contexte : la page Préférences (profile-preferences-page.jsx) écrivait déjà
-- `updateProfile({ country_code })`, mais la colonne n'existait pas → l'UPDATE
-- PostgREST échouait en silence et le pays ne se sauvegardait jamais (toujours
-- « aucun » au retour). Colonne nullable, additive, non destructive.
--
-- Sert de base à : saisonnalité par pays (filtre Saison) + disposition frigo.

alter table public.profiles add column if not exists country_code text;
comment on column public.profiles.country_code is 'Pays favori de l''utilisateur (code pays taxonomies.country). Nullable. Base pour saisonnalité par pays + disposition frigo.';
