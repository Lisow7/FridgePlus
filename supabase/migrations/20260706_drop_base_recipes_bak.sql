-- Supprime la table de sauvegarde temporaire base_recipes_bak_20260701.
--
-- Snapshot du 2026-07-01 (501 lignes id+ingredients), 100 % redondant avec
-- recipes_unified (0 id absent), aucune dépendance (vue/FK/fonction). Clôt 3
-- advisors Supabase (rls_enabled_no_policy, no_primary_key) + une TODO
-- post-launch. Filet de sécurité : sauvegarde chiffrée hebdomadaire en place.
drop table if exists public.base_recipes_bak_20260701;
