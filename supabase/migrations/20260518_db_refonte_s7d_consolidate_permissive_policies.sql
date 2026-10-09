-- ============================================================
-- v0.16.x — Refonte BDD Sprint 7d — Consolider multiple_permissive policies
-- ------------------------------------------------------------
-- Cible : 45 multiple_permissive_policies lints sur 11 tables actives
-- (hors *_legacy qui disparaîtront en Sprint 5e).
--
-- Pattern PostgreSQL : quand 2+ policies PERMISSIVE existent pour le même
-- role+action sur la même table, Postgres exécute TOUTES et combine via OR.
-- Coûteux à chaque query (RLS init-plan x2-3). Cible 2026 = 1 policy par
-- (role, action) — utiliser OR dans le qual plutôt qu'empiler.
--
-- Stratégie par table :
--   - 5 tables (ingredients, fridge_layouts, community_posts/replies,
--     recipes_unified) : merger les SELECT publics dupliqués en 1 policy OR
--   - 5 tables (support_*, profiles, activity_logs, engagement, user_favorites)
--     : merger admin (FOR ALL) avec policies own en is_admin() OR <user_cond>
--
-- Résultat attendu : 0 multiple_permissive sur ces 11 tables.
-- ============================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) ingredients — DROP doublon trivial (2 SELECT identiques qual=true)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS ingredients_select_all ON public.ingredients;
-- ingredients_select_public reste (qual=true, identique). -6 lints (x6 roles).

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) fridge_layouts — split admin ALL en INSERT/UPDATE/DELETE (sans SELECT)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS fridge_layouts_modify_admin ON public.fridge_layouts;

CREATE POLICY fridge_layouts_insert_admin ON public.fridge_layouts
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY fridge_layouts_update_admin ON public.fridge_layouts
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY fridge_layouts_delete_admin ON public.fridge_layouts
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());

-- fridge_layouts_select_public reste (lecture libre par tous). -6 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) community_posts — merger les 2 SELECT en 1
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authors read own deleted posts" ON public.community_posts;
DROP POLICY IF EXISTS "Public read non-deleted posts" ON public.community_posts;

CREATE POLICY community_posts_select ON public.community_posts
  AS PERMISSIVE FOR SELECT TO public
  USING (
    deleted_at IS NULL
    OR (SELECT auth.uid()) = user_id
  );
-- -6 lints (x6 roles).

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) community_replies — même pattern
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Authors read own deleted replies" ON public.community_replies;
DROP POLICY IF EXISTS "Public read non-deleted replies" ON public.community_replies;

CREATE POLICY community_replies_select ON public.community_replies
  AS PERMISSIVE FOR SELECT TO public
  USING (
    deleted_at IS NULL
    OR (SELECT auth.uid()) = user_id
  );
-- -6 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) engagement — merger admin+own+public sur SELECT/UPDATE/DELETE
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS engagement_select_admin  ON public.engagement;
DROP POLICY IF EXISTS engagement_select_own    ON public.engagement;
DROP POLICY IF EXISTS engagement_select_public ON public.engagement;
DROP POLICY IF EXISTS engagement_update_admin  ON public.engagement;
DROP POLICY IF EXISTS engagement_update_own    ON public.engagement;
DROP POLICY IF EXISTS engagement_delete_admin  ON public.engagement;
DROP POLICY IF EXISTS engagement_delete_own    ON public.engagement;

CREATE POLICY engagement_select ON public.engagement
  AS PERMISSIVE FOR SELECT TO public
  USING (
    is_admin()
    OR (SELECT auth.uid()) = user_id
    OR deleted_at IS NULL
  );

CREATE POLICY engagement_update ON public.engagement
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR ((SELECT auth.uid()) = user_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY engagement_delete ON public.engagement
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );
-- -3 lints (SELECT, UPDATE, DELETE).

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) support_tickets — merger admin_all (FOR ALL) avec policies own
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS admin_all_tickets   ON public.support_tickets;
DROP POLICY IF EXISTS tickets_insert_own  ON public.support_tickets;
DROP POLICY IF EXISTS tickets_select_own  ON public.support_tickets;
DROP POLICY IF EXISTS tickets_update_own  ON public.support_tickets;

CREATE POLICY support_tickets_insert ON public.support_tickets
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY support_tickets_select ON public.support_tickets
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY support_tickets_update ON public.support_tickets
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );

CREATE POLICY support_tickets_delete ON public.support_tickets
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());
-- -3 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) support_messages — merger admin_all (FOR ALL) avec policies insert/select
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS admin_all_messages ON public.support_messages;
DROP POLICY IF EXISTS messages_insert    ON public.support_messages;
DROP POLICY IF EXISTS messages_select    ON public.support_messages;

CREATE POLICY support_messages_insert ON public.support_messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY support_messages_select ON public.support_messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY support_messages_update ON public.support_messages
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY support_messages_delete ON public.support_messages
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());
-- -2 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) activity_logs — merger admin+own sur INSERT, drop doublon SELECT
-- ═══════════════════════════════════════════════════════════════════════════
-- activity_logs_select_admin et logs_select_admin sont strictement identiques
-- (qual=is_admin()) sur des roles différents (authenticated vs public).
DROP POLICY IF EXISTS logs_select_admin ON public.activity_logs;
-- activity_logs_select_admin reste (sur authenticated).

DROP POLICY IF EXISTS activity_logs_insert_admin ON public.activity_logs;
DROP POLICY IF EXISTS logs_insert                ON public.activity_logs;

CREATE POLICY activity_logs_insert ON public.activity_logs
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );
-- -2 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 9) profiles — merger admin+own sur SELECT et UPDATE
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own   ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own   ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = id
  );

CREATE POLICY profiles_update ON public.profiles
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = id
  )
  WITH CHECK (
    is_admin()
    OR (SELECT auth.uid()) = id
  );
-- -2 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 10) user_favorites — merger admin+own sur SELECT
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS user_favorites_select_admin ON public.user_favorites;
DROP POLICY IF EXISTS fav_select                  ON public.user_favorites;

CREATE POLICY user_favorites_select ON public.user_favorites
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (SELECT auth.uid()) = user_id
  );
-- -1 lint.

-- ═══════════════════════════════════════════════════════════════════════════
-- 11) recipes_unified — consolidation complète (le plus complexe, 8 lints)
-- ═══════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS recipes_unified_delete_admin             ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_insert_admin             ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_insert_community_own     ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_select_admin             ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_select_community_public  ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_select_official_public   ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_select_own               ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_update_admin             ON public.recipes_unified;
DROP POLICY IF EXISTS recipes_unified_update_community_own     ON public.recipes_unified;

-- SELECT consolidé : admin OR official_published OR community_approved OR community_own
CREATE POLICY recipes_unified_select ON public.recipes_unified
  AS PERMISSIVE FOR SELECT TO public
  USING (
    is_admin()
    OR (origin = 'official' AND status IN ('published', 'featured'))
    OR (origin = 'community' AND is_public = true AND moderation_status = 'approved' AND deleted_at IS NULL)
    OR (origin = 'community' AND user_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  );

-- INSERT : admin OR community_own
CREATE POLICY recipes_unified_insert ON public.recipes_unified
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (origin = 'community' AND user_id = (SELECT auth.uid()))
  );

-- UPDATE : admin OR community_own (with prevent_edit_approved_recipe trigger comme garde-fou)
CREATE POLICY recipes_unified_update ON public.recipes_unified
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (origin = 'community' AND user_id = (SELECT auth.uid()) AND deleted_at IS NULL)
  )
  WITH CHECK (
    is_admin()
    OR (origin = 'community' AND user_id = (SELECT auth.uid()))
  );

-- DELETE : admin only (user delete passe par RPC delete_custom_recipe_rgpd)
CREATE POLICY recipes_unified_delete ON public.recipes_unified
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (is_admin());
-- -8 lints.

-- ═══════════════════════════════════════════════════════════════════════════
-- 12) FIX RÉGRESSION S7c — re-grant is_admin() à anon
-- ═══════════════════════════════════════════════════════════════════════════
-- Sprint 7c a fait REVOKE EXECUTE FROM PUBLIC sur is_admin(). Mais nos
-- nouvelles policies SELECT consolidées (recipes_unified, community_posts,
-- engagement, etc.) appellent is_admin() même en contexte public/anon.
-- Sans EXECUTE permission, anon échoue avec 401 → reads cassés.
--
-- Détecté en smoke test Vercel preview : 401 sur custom_recipes view +
-- recipes_unified depuis le navigateur anon.
--
-- Solution : re-grant is_admin() à anon. La fonction reste sûre — pour
-- un caller anon, auth.uid() = null donc EXISTS profile = false → retourne
-- false. Aucune fuite d'information possible.
--
-- Trade-off acceptable vs réduction surface RPC :
-- - is_admin() utilisable via /rest/v1/rpc/is_admin par anon (retournera false)
-- - Gain : 45 lints multiple_permissive éliminés, RLS init-plan ÷2-3
-- - L'expo de is_admin() à anon n'est pas une vraie surface d'attaque
--   (déjà un read-only check sur la table profiles via RLS)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

COMMIT;
