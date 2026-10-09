-- Restaure `security_invoker` sur la vue `recipe_health_check`.
--
-- ✅ APPLIQUÉE EN PRODUCTION le 2026-08-09 via `apply_migration`
--    (entrée `restaure_security_invoker_recipe_health_check`).
--    Vérifié après coup : advisors sécurité repassés à **0 ERROR**, la vue porte
--    `security_invoker=on`, et un JWT admin simulé voit toujours 515 recettes /
--    653 ingrédients — l'écran Qualité n'est pas cassé.
--
-- ─── LE DÉFAUT ───────────────────────────────────────────────────────────────
-- Les advisors Supabase remontent un ERROR « Security Definer View » sur
-- `public.recipe_health_check` (mesuré le 2026-08-09). Le scan du 2026-06-21
-- était à 0 ERROR : c'est donc une RÉGRESSION, pas une dette d'origine.
--
-- ─── LA CAUSE RACINE ─────────────────────────────────────────────────────────
-- Les quatre migrations qui ont créé ou refait cette vue posaient toutes
-- l'option juste après le CREATE :
--
--   20260503_extend_base_recipes.sql:97               ALTER VIEW ... security_invoker = on
--   20260507_fix_quality_checks.sql:105               idem
--   20260509_data_quality_v2_v3_129_1.sql:97          idem
--   20260518_db_refonte_s8_quality_v2_health_checks.sql:187  idem
--
-- La cinquième — `20260727_fix_recipe_health_check_enriched_ingredients.sql`,
-- qui réparait la vue cassée en production — refait un `create or replace view`
-- et NE repose PAS l'option. Postgres a donc rendu la vue à son comportement par
-- défaut : SECURITY DEFINER, c'est-à-dire les droits du créateur.
--
-- Preuve : `recipe_health_check` est la SEULE vue du schéma `public` dont
-- `pg_class.reloptions` est NULL. Sa jumelle `ingredient_health_check`, non
-- touchée ce jour-là, porte toujours `security_invoker=on` — comme
-- `base_recipes`, `custom_recipes` et `ai_usage_daily_summary`.
--
-- ─── CE QUE ÇA EXPOSE ────────────────────────────────────────────────────────
-- La vue est en GRANT SELECT à `anon` et `authenticated`, et son seul filtre
-- est `WHERE r.deleted_at IS NULL` : ni `status`, ni `origin`, ni `user_id`.
-- En SECURITY DEFINER, la RLS de `recipes_unified` ne s'applique pas — alors
-- qu'elle dit précisément :
--
--   is_admin()
--   OR (origin = 'official'  AND status IN ('published','featured'))
--   OR (origin = 'community' AND is_public AND moderation_status = 'approved')
--
-- ⚠️ MESURE DU JOUR : l'écart est NUL. En rôle `anon`, la vue rend 515 lignes et
-- la table sous RLS en rend 515 aussi — parce que la base ne contient à ce jour
-- que des recettes officielles publiées (0 recette communauté). **Il n'y a donc
-- aucune fuite constatable.** Le défaut est LATENT : à la première recette
-- utilisateur en brouillon ou en attente de modération, son `id`, son `name_fr`,
-- son `status` et son `country` deviennent lisibles sans compte via
-- `/rest/v1/recipe_health_check`.
--
-- ─── POURQUOI CE CORRECTIF NE CASSE RIEN ─────────────────────────────────────
-- Les trois consommateurs de la vue ont été vérifiés un par un :
--
--   api/cron/quality-check.js:24   SUPABASE_SERVICE_ROLE_KEY  → RLS contournée
--   scripts/quality-audit.mjs:26   SUPABASE_SERVICE_ROLE_KEY  → RLS contournée
--   src/features/admin/api/admin.js:250  JWT admin → `is_admin()` vrai, donc la
--                                  policy SELECT lui rend TOUTES les lignes
--
-- Aucun ne perd de données. C'est d'ailleurs le régime sous lequel l'écran
-- Qualité a tourné de mai à juillet 2026, avant la régression.
--
-- ─── RÉVERSIBILITÉ ───────────────────────────────────────────────────────────
-- Une ligne, annulable par `ALTER VIEW ... SET (security_invoker = off)`.
-- Aucune donnée touchée, aucune colonne, aucune policy.

ALTER VIEW public.recipe_health_check SET (security_invoker = on);

-- Même chemin de code, second advisor (WARN « Function Search Path Mutable ») :
-- `recipe_ingredient_items` est appelée DANS cette vue et n'a pas de search_path
-- figé. Elle est SECURITY INVOKER (`prosecdef = false`), donc le détournement de
-- search_path n'y donne aucun privilège que l'appelant n'ait déjà — c'est de la
-- défense en profondeur, pas la fermeture d'une faille. On la fige ici parce
-- qu'on écrit déjà la posture de sécurité de cette vue ; la traiter à part
-- coûterait une seconde migration pour une seule ligne.
ALTER FUNCTION public.recipe_ingredient_items(jsonb) SET search_path = public;

COMMENT ON VIEW public.recipe_health_check IS
  'Diagnostic qualité des recettes (issues par recette). security_invoker = on : '
  'la RLS de recipes_unified s''applique à l''appelant — un admin voit tout via '
  'is_admin(), un visiteur ne voit que le catalogue public. NE PAS refaire cette '
  'vue par CREATE OR REPLACE sans reposer cette option juste après : c''est '
  'exactement ainsi qu''elle a été perdue le 2026-07-27.';
