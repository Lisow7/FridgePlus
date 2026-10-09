-- ============================================================
-- v0.16.x — Refonte BDD Sprint 3 — Backfill migration tracking (PR-DB-06)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Problème : la table `supabase_migrations.schema_migrations` ne traçait que
-- 11 entrées au 17 mai au soir, alors que `supabase/migrations/` contient
-- 66 fichiers .sql. Les 55 manquantes ont été appliquées via Dashboard SQL
-- Editor ou MCP `apply_migration` sans tracking. Si un dev fait
-- `supabase db push` plus tard, le CLI tentera de les rejouer (CREATE TABLE
-- déjà existante → erreurs cascade).
--
-- Solution : backfill les 58 fichiers locaux manquants (sur les 67 actuels —
-- 9 sont déjà trackés sous une autre version comme `20260429` ou
-- `20260517XXXXXX`). Utilise `ON CONFLICT DO NOTHING` pour idempotence.
--
-- `statements` reste NULL : les schémas sont déjà appliqués en prod, le
-- tracking ne sert qu'à empêcher la re-application. Si un dev veut le
-- contenu original, il regardera le fichier .sql dans le repo git.
--
-- À partir de cette migration (PR-DB-06), TOUT futur changement de schéma
-- DOIT passer par `apply_migration` MCP ou `supabase db push` (qui
-- enregistrera automatiquement dans le tracking).
-- ============================================================

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260429_basket_items', 'basket_items'),
  ('20260429_ingredient_nutrition', 'ingredient_nutrition'),
  ('20260429_user_leftovers', 'user_leftovers'),
  ('20260430_admin_rls_policies', 'admin_rls_policies'),
  ('20260430_profile_allergen_prefs', 'profile_allergen_prefs'),
  ('20260430_profile_password_changed_at', 'profile_password_changed_at'),
  ('20260430_profile_soft_delete', 'profile_soft_delete'),
  ('20260430_profile_username_unique', 'profile_username_unique'),
  ('20260501_activity_logs_append_only', 'activity_logs_append_only'),
  ('20260501_admin_user_favorites_rls', 'admin_user_favorites_rls'),
  ('20260501_data_migration_v3', 'data_migration_v3'),
  ('20260502_activity_logs_metadata', 'activity_logs_metadata'),
  ('20260502_notifications', 'notifications'),
  ('20260502_promote_recipe_to_base', 'promote_recipe_to_base'),
  ('20260502_recipe_consent_to_promote', 'recipe_consent_to_promote'),
  ('20260502_recipe_deletion_rgpd', 'recipe_deletion_rgpd'),
  ('20260503_admin_review_moderation', 'admin_review_moderation'),
  ('20260503_basket_manual_add', 'basket_manual_add'),
  ('20260503_community_moderation', 'community_moderation'),
  ('20260503_community_reply_threading', 'community_reply_threading'),
  ('20260503_community_terms', 'community_terms'),
  ('20260503_consolidate_reports_into_support_tickets', 'consolidate_reports_into_support_tickets'),
  ('20260503_create_community', 'create_community'),
  ('20260503_create_cooking_logs', 'create_cooking_logs'),
  ('20260503_create_master_difficulty_meal', 'create_master_difficulty_meal'),
  ('20260503_create_master_subcategories', 'create_master_subcategories'),
  ('20260503_create_recipe_reviews', 'create_recipe_reviews'),
  ('20260503_create_reports', 'create_reports'),
  ('20260503_create_seasonal_months', 'create_seasonal_months'),
  ('20260503_delete_custom_recipe_text_id', 'delete_custom_recipe_text_id'),
  ('20260503_drop_legacy_tables', 'drop_legacy_tables'),
  ('20260503_extend_base_recipes', 'extend_base_recipes'),
  ('20260503_extend_ingredients', 'extend_ingredients'),
  ('20260503_extend_profiles_rgpd', 'extend_profiles_rgpd'),
  ('20260503_fix_admin_rpc_is_admin_check', 'fix_admin_rpc_is_admin_check'),
  ('20260503_pg_cron_purges', 'pg_cron_purges'),
  ('20260503_rpc_anonymize_user', 'rpc_anonymize_user'),
  ('20260504_basket_servings_stepper', 'basket_servings_stepper'),
  ('20260505_basket_nullable_v3_59_0', 'basket_nullable_v3_59_0'),
  ('20260505_fusion_miso_algues_v3_43_0', 'fusion_miso_algues_v3_43_0'),
  ('20260505_ingredient_cleanup_v3_28_0', 'ingredient_cleanup_v3_28_0'),
  ('20260505_rename_nutella_v3_71_0', 'rename_nutella_v3_71_0'),
  ('20260505_shopping_lists_v3_51_0', 'shopping_lists_v3_51_0'),
  ('20260507_admin_send_notification', 'admin_send_notification'),
  ('20260507_fix_quality_checks', 'fix_quality_checks'),
  ('20260507_moderation_reason', 'moderation_reason'),
  ('20260508_add_subscription_to_profiles', 'add_subscription_to_profiles'),
  ('20260509_community_post_recipe_v3_165_0', 'community_post_recipe_v3_165_0'),
  ('20260509_data_quality_v2_v3_129_1', 'data_quality_v2_v3_129_1'),
  ('20260509_monthly_budget_v3_128_0', 'monthly_budget_v3_128_0'),
  ('20260509_post_reactions_v3_164_0', 'post_reactions_v3_164_0'),
  ('20260509_shared_baskets_v3_127_0', 'shared_baskets_v3_127_0'),
  ('20260510_community_bio_v3_166_0', 'community_bio_v3_166_0'),
  ('20260510_community_blocks_v3_166_3', 'community_blocks_v3_166_3'),
  ('20260510_spending_events_v3_167_0', 'spending_events_v3_167_0'),
  ('20260515_fix_inactive_view_security_v3_373_0', 'fix_inactive_view_security_v3_373_0'),
  ('20260515_inactive_accounts_purge_v3_370_0', 'inactive_accounts_purge_v3_370_0'),
  ('20260515_profiling_opt_out_v3_364_0', 'profiling_opt_out_v3_364_0')
ON CONFLICT (version) DO NOTHING;
