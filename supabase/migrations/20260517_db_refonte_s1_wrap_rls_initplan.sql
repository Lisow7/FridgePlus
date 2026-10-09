-- ============================================================
-- v0.16.x — Refonte BDD Sprint 1 — Wrap RLS initPlan (PR-DB-02)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings advisors : `project_db_advisors_findings_2026_05_17.md`
--
-- Élimine les ~70 advisors WARN `auth_rls_initplan` :
-- `auth.uid()` ré-évalué par row (cost O(n)) → wrap en `(select auth.uid())`
-- → l'optimiseur Postgres le hisse en initPlan (1 seule éval par query)
-- → gain 2-11× sur grosses tables (cf. doc Supabase).
--
-- Toutes les policies ci-dessous gardent leur cmd, roles, qual et with_check
-- ORIGINAUX — on ne change QUE le wrap de `auth.uid()`. Hors-scope de cette
-- PR (faits dans des sprints suivants) :
--   - Changement TO public → TO authenticated (advisor warning séparé)
--   - Fusion des permissive policies cumulées admin+public (Sprint 7)
--   - Refacto admin via service_role (Sprint 7)
--
-- Pattern : DROP POLICY ... ON ... ; CREATE POLICY ... avec (select auth.uid())
-- Transaction atomique : si une seule recreation échoue, ROLLBACK complet.
-- ============================================================

BEGIN;

-- ─── activity_logs ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS logs_insert ON public.activity_logs;
CREATE POLICY logs_insert ON public.activity_logs
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── basket_items ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS basket_delete_own ON public.basket_items;
CREATE POLICY basket_delete_own ON public.basket_items
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS basket_insert_own ON public.basket_items;
CREATE POLICY basket_insert_own ON public.basket_items
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS basket_select_own ON public.basket_items;
CREATE POLICY basket_select_own ON public.basket_items
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS basket_update_own ON public.basket_items;
CREATE POLICY basket_update_own ON public.basket_items
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select auth.uid()) = user_id);

-- ─── community_blocks ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS community_blocks_delete_own ON public.community_blocks;
CREATE POLICY community_blocks_delete_own ON public.community_blocks
  AS PERMISSIVE FOR DELETE TO public
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS community_blocks_insert_own ON public.community_blocks;
CREATE POLICY community_blocks_insert_own ON public.community_blocks
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS community_blocks_select_own ON public.community_blocks;
CREATE POLICY community_blocks_select_own ON public.community_blocks
  AS PERMISSIVE FOR SELECT TO public
  USING (user_id = (select auth.uid()));

-- ─── community_likes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users delete own likes" ON public.community_likes;
CREATE POLICY "Users delete own likes" ON public.community_likes
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own likes" ON public.community_likes;
CREATE POLICY "Users insert own likes" ON public.community_likes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── community_posts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated insert posts" ON public.community_posts;
CREATE POLICY "Authenticated insert posts" ON public.community_posts
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors delete own posts" ON public.community_posts;
CREATE POLICY "Authors delete own posts" ON public.community_posts
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors read own deleted posts" ON public.community_posts;
CREATE POLICY "Authors read own deleted posts" ON public.community_posts
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors update own posts" ON public.community_posts;
CREATE POLICY "Authors update own posts" ON public.community_posts
  AS PERMISSIVE FOR UPDATE TO public
  USING (((select auth.uid()) = user_id) AND (deleted_by_admin = false))
  WITH CHECK (((select auth.uid()) = user_id) AND (deleted_by_admin = false));

-- ─── community_replies ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated insert replies" ON public.community_replies;
CREATE POLICY "Authenticated insert replies" ON public.community_replies
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors delete own replies" ON public.community_replies;
CREATE POLICY "Authors delete own replies" ON public.community_replies
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors read own deleted replies" ON public.community_replies;
CREATE POLICY "Authors read own deleted replies" ON public.community_replies
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors update own replies" ON public.community_replies;
CREATE POLICY "Authors update own replies" ON public.community_replies
  AS PERMISSIVE FOR UPDATE TO public
  USING (((select auth.uid()) = user_id) AND (deleted_by_admin = false))
  WITH CHECK (((select auth.uid()) = user_id) AND (deleted_by_admin = false));

-- ─── community_reply_likes ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users delete own reply likes" ON public.community_reply_likes;
CREATE POLICY "Users delete own reply likes" ON public.community_reply_likes
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own reply likes" ON public.community_reply_likes;
CREATE POLICY "Users insert own reply likes" ON public.community_reply_likes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── cooking_logs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users delete own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users delete own cooking logs" ON public.cooking_logs
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users insert own cooking logs" ON public.cooking_logs
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users select own cooking logs" ON public.cooking_logs;
CREATE POLICY "Users select own cooking logs" ON public.cooking_logs
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

-- ─── custom_recipes ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS recipes_insert ON public.custom_recipes;
CREATE POLICY recipes_insert ON public.custom_recipes
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS recipes_select_own ON public.custom_recipes;
CREATE POLICY recipes_select_own ON public.custom_recipes
  AS PERMISSIVE FOR SELECT TO public
  USING (((select auth.uid()) = user_id) AND (deleted_at IS NULL));

DROP POLICY IF EXISTS recipes_update_own ON public.custom_recipes;
CREATE POLICY recipes_update_own ON public.custom_recipes
  AS PERMISSIVE FOR UPDATE TO public
  USING (((select auth.uid()) = user_id) AND (deleted_at IS NULL));

-- ─── notifications ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (recipient_id = (select auth.uid()));

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((recipient_id = (select auth.uid())) OR ((recipient_id IS NULL) AND (recipient_role = 'admin'::text) AND is_admin()));

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()))
  WITH CHECK (recipient_id = (select auth.uid()));

-- ─── post_reactions ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS reactions_delete ON public.post_reactions;
CREATE POLICY reactions_delete ON public.post_reactions
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS reactions_insert ON public.post_reactions;
CREATE POLICY reactions_insert ON public.post_reactions
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS reactions_update ON public.post_reactions;
CREATE POLICY reactions_update ON public.post_reactions
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── profiles ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select auth.uid()) = id);

-- ─── recipe_reviews ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated insert reviews" ON public.recipe_reviews;
CREATE POLICY "Authenticated insert reviews" ON public.recipe_reviews
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors delete own reviews" ON public.recipe_reviews;
CREATE POLICY "Authors delete own reviews" ON public.recipe_reviews
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors read own deleted reviews" ON public.recipe_reviews;
CREATE POLICY "Authors read own deleted reviews" ON public.recipe_reviews
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Authors update own reviews" ON public.recipe_reviews;
CREATE POLICY "Authors update own reviews" ON public.recipe_reviews
  AS PERMISSIVE FOR UPDATE TO public
  USING (((select auth.uid()) = user_id) AND (deleted_by_admin = false))
  WITH CHECK (((select auth.uid()) = user_id) AND (deleted_by_admin = false));

-- ─── shared_baskets ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS shared_baskets_owner_delete ON public.shared_baskets;
CREATE POLICY shared_baskets_owner_delete ON public.shared_baskets
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS shared_baskets_owner_insert ON public.shared_baskets;
CREATE POLICY shared_baskets_owner_insert ON public.shared_baskets
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── shopping_lists ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS shopping_lists_delete_own ON public.shopping_lists;
CREATE POLICY shopping_lists_delete_own ON public.shopping_lists
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS shopping_lists_insert_own ON public.shopping_lists;
CREATE POLICY shopping_lists_insert_own ON public.shopping_lists
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS shopping_lists_select_own ON public.shopping_lists;
CREATE POLICY shopping_lists_select_own ON public.shopping_lists
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS shopping_lists_update_own ON public.shopping_lists;
CREATE POLICY shopping_lists_update_own ON public.shopping_lists
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── spending_events ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS spending_events_delete_own ON public.spending_events;
CREATE POLICY spending_events_delete_own ON public.spending_events
  AS PERMISSIVE FOR DELETE TO public
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS spending_events_insert_own ON public.spending_events;
CREATE POLICY spending_events_insert_own ON public.spending_events
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS spending_events_select_own ON public.spending_events;
CREATE POLICY spending_events_select_own ON public.spending_events
  AS PERMISSIVE FOR SELECT TO public
  USING (user_id = (select auth.uid()));

-- ─── subscription_events ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_read_subscription_events ON public.subscription_events;
CREATE POLICY admin_read_subscription_events ON public.subscription_events
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

-- ─── support_messages ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_all_messages ON public.support_messages;
CREATE POLICY admin_all_messages ON public.support_messages
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

DROP POLICY IF EXISTS messages_insert ON public.support_messages;
CREATE POLICY messages_insert ON public.support_messages
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS (SELECT 1 FROM support_tickets WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = (select auth.uid()))))) OR (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));

DROP POLICY IF EXISTS messages_select ON public.support_messages;
CREATE POLICY messages_select ON public.support_messages
  AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS (SELECT 1 FROM support_tickets WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = (select auth.uid()))))) OR (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));

DROP POLICY IF EXISTS users_insert_messages ON public.support_messages;
CREATE POLICY users_insert_messages ON public.support_messages
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = sender_id) AND (EXISTS (SELECT 1 FROM support_tickets WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = (select auth.uid()))))));

DROP POLICY IF EXISTS users_select_own_messages ON public.support_messages;
CREATE POLICY users_select_own_messages ON public.support_messages
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM support_tickets WHERE ((support_tickets.id = support_messages.ticket_id) AND (support_tickets.user_id = (select auth.uid())))));

-- ─── support_tickets ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS admin_all_tickets ON public.support_tickets;
CREATE POLICY admin_all_tickets ON public.support_tickets
  AS PERMISSIVE FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

DROP POLICY IF EXISTS tickets_insert_own ON public.support_tickets;
CREATE POLICY tickets_insert_own ON public.support_tickets
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS tickets_select_admin ON public.support_tickets;
CREATE POLICY tickets_select_admin ON public.support_tickets
  AS PERMISSIVE FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

DROP POLICY IF EXISTS tickets_select_own ON public.support_tickets;
CREATE POLICY tickets_select_own ON public.support_tickets
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS tickets_update_admin ON public.support_tickets;
CREATE POLICY tickets_update_admin ON public.support_tickets
  AS PERMISSIVE FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))));

DROP POLICY IF EXISTS tickets_update_own ON public.support_tickets;
CREATE POLICY tickets_update_own ON public.support_tickets
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS users_insert_own_tickets ON public.support_tickets;
CREATE POLICY users_insert_own_tickets ON public.support_tickets
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS users_select_own_tickets ON public.support_tickets;
CREATE POLICY users_select_own_tickets ON public.support_tickets
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS users_update_own_tickets ON public.support_tickets;
CREATE POLICY users_update_own_tickets ON public.support_tickets
  AS PERMISSIVE FOR UPDATE TO public
  USING ((select auth.uid()) = user_id);

-- ─── user_favorites ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS fav_delete ON public.user_favorites;
CREATE POLICY fav_delete ON public.user_favorites
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS fav_insert ON public.user_favorites;
CREATE POLICY fav_insert ON public.user_favorites
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS fav_select ON public.user_favorites;
CREATE POLICY fav_select ON public.user_favorites
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

-- ─── user_leftovers ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS leftovers_owner_all ON public.user_leftovers;
CREATE POLICY leftovers_owner_all ON public.user_leftovers
  AS PERMISSIVE FOR ALL TO public
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── user_stock ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS stock_delete ON public.user_stock;
CREATE POLICY stock_delete ON public.user_stock
  AS PERMISSIVE FOR DELETE TO public
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS stock_insert ON public.user_stock;
CREATE POLICY stock_insert ON public.user_stock
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS stock_select ON public.user_stock;
CREATE POLICY stock_select ON public.user_stock
  AS PERMISSIVE FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

COMMIT;
