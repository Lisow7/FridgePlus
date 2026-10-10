-- Les notes des recettes, agrégées par la base (audit du 2026-10-04, PERF-12).
--
-- Jusqu'ici le navigateur relisait TOUS les avis des recettes affichées (six
-- requêtes de 100 identifiants) et faisait lui-même les moyennes — fausses
-- sans bruit au-delà de la limite de 1 000 lignes de l'API. Cette vue rend,
-- par recette notée, la moyenne (arrondie au dixième, comme l'app) et le
-- nombre d'avis vivants ; l'app la lit en une requête.
--
-- `security_invoker = true` : la règle `engagement_select` de l'appelant
-- s'applique (un visiteur ne compte que les avis publics, l'admin tout).
-- Lecture ouverte à anon et authenticated, comme les avis eux-mêmes.
--
-- Compatible avec la v0.145 en production (rien n'en dépend avant l'app qui la
-- lit). Attend la confirmation d'Antoine : essai à blanc par la sonde
-- supabase/probes/20261009_notes_en_une_lecture.sql, puis apply_migration, puis
-- `npm run db:types` (la vue entre dans database.ts). Nom à 14 chiffres
-- provisoire (heure d'écriture) : à renommer à la version inscrite.

CREATE OR REPLACE VIEW public.recipe_rating_aggregates
WITH (security_invoker = true) AS
  SELECT target_recipe_id AS recipe_id,
         round(avg(rating)::numeric, 1) AS avg,
         count(*)::integer AS count
    FROM public.engagement
   WHERE type = 'review'
     AND deleted_at IS NULL
     AND rating BETWEEN 1 AND 5
   GROUP BY target_recipe_id;

-- Reposé explicitement, en plus de la clause WITH : le garde-fou
-- `migrations-view-security-invoker` tient le dépôt sur cet ALTER (une vue
-- refaite sans lui revient à SECURITY DEFINER — recipe_health_check, 2026-08).
ALTER VIEW public.recipe_rating_aggregates SET (security_invoker = on);

COMMENT ON VIEW public.recipe_rating_aggregates IS
  'Moyenne (au dixième) et nombre d''avis vivants par recette — lue par le panneau des recettes en une requête (audit 2026-10-04, PERF-12).';

GRANT SELECT ON public.recipe_rating_aggregates TO anon, authenticated;
