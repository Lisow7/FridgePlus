-- L'index en double sur lower(username) (audit du 2026-10-04, BDD-21 (3) ;
-- décision du 2026-10-08 tranchée par Antoine le 2026-10-08 : `index_double = oui`,
-- « quand je suis là pour confirmer » — apply_migration demande sa confirmation
-- pour un DROP).
--
-- Deux index UNIQUE font le même travail, vérifié en base le 2026-10-08 :
--   - `profiles_username_unique_lower` (WHERE username IS NOT NULL), créé par
--     20260430_profile_username_unique.sql ;
--   - `profiles_username_lower_idx` (sans WHERE), créé par AUCUNE migration du
--     dépôt.
-- Chaque inscription et chaque changement de pseudo les met à jour deux fois.
-- Retirer celui qui n'a pas de fichier remet le dépôt et la base d'accord ;
-- l'unicité ne change pas (deux NULL ne se heurtent pas, avec ou sans WHERE).
-- Le client ne dépend pas du nom de l'index : src/shared/lib/auth/username-rules.js
-- ne lit que le code 23505.

DROP INDEX IF EXISTS public.profiles_username_lower_idx;
