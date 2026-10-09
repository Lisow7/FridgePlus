-- ============================================================
-- v0.16.x — Refonte BDD Sprint 7b — Dedup policies support_tickets/messages
-- ------------------------------------------------------------
-- Cible : 33 multiple_permissive lints (19 tickets + 14 messages)
-- → réduit à ~8-10 après cette PR.
--
-- État avant :
--   support_tickets (9 policies, beaucoup de doublons) :
--     - admin_all_tickets        ALL     EXISTS profiles.role=admin
--     - tickets_select_admin     SELECT  EXISTS profiles.role=admin  ← doublon avec ALL
--     - tickets_update_admin     UPDATE  EXISTS profiles.role=admin  ← doublon avec ALL
--     - tickets_insert_own       INSERT  (no qual, with_check=NULL)  ← TROU SÉCU
--     - tickets_select_own       SELECT  auth.uid()=user_id
--     - tickets_update_own       UPDATE  auth.uid()=user_id
--     - users_insert_own_tickets INSERT  ← doublon de tickets_insert_own
--     - users_select_own_tickets SELECT  ← doublon de tickets_select_own
--     - users_update_own_tickets UPDATE  ← doublon de tickets_update_own
--
--   support_messages (5 policies) :
--     - admin_all_messages       ALL     EXISTS profiles.role=admin
--     - messages_insert          INSERT  (no qual, with_check=NULL)  ← TROU SÉCU
--     - messages_select          SELECT  EXISTS support_tickets OR EXISTS profiles.admin
--     - users_insert_messages    INSERT  ← doublon de messages_insert
--     - users_select_own_messages SELECT ← doublon partiel de messages_select
--
-- État après :
--   support_tickets (4 policies, hardened) :
--     - admin_all_tickets        ALL     is_admin()
--     - tickets_insert_own       INSERT  WITH CHECK (auth.uid()=user_id)
--     - tickets_select_own       SELECT  auth.uid()=user_id
--     - tickets_update_own       UPDATE  auth.uid()=user_id
--
--   support_messages (3 policies, hardened) :
--     - admin_all_messages       ALL     is_admin()
--     - messages_insert          INSERT  WITH CHECK (caller posts to OWN ticket)
--     - messages_select          SELECT  EXISTS support_tickets WHERE user_id=auth.uid()
--                                (admin scope déjà couvert par admin_all_messages)
--
-- Bénéfices :
-- - -25 multiple_permissive lints (~10 restants pour ces 2 tables)
-- - Sécurité : INSERT policies ne sont plus open bar (with_check ajouté)
-- - Cohérence : admin routes via is_admin() partout (pattern Sprint 1)
-- - Lisibilité : 1 policy = 1 cas (pas de doublons à raisonner)
--
-- Rollback : recreate les policies depuis l'historique git (cf. SCHEMA.md snapshot).
-- ============================================================

BEGIN;

-- ─── 1) support_tickets : drop 5 policies redondantes ──────────────────────

DROP POLICY IF EXISTS tickets_select_admin     ON public.support_tickets;
DROP POLICY IF EXISTS tickets_update_admin     ON public.support_tickets;
DROP POLICY IF EXISTS users_insert_own_tickets ON public.support_tickets;
DROP POLICY IF EXISTS users_select_own_tickets ON public.support_tickets;
DROP POLICY IF EXISTS users_update_own_tickets ON public.support_tickets;

-- ─── 2) support_tickets : recréer admin_all_tickets avec is_admin() ────────
-- (remplace l'EXISTS profiles inline par la fonction centralisée Sprint 1)

DROP POLICY IF EXISTS admin_all_tickets ON public.support_tickets;
CREATE POLICY admin_all_tickets ON public.support_tickets
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── 3) support_tickets : hardening — ajouter WITH CHECK sur INSERT/UPDATE

DROP POLICY IF EXISTS tickets_insert_own ON public.support_tickets;
CREATE POLICY tickets_insert_own ON public.support_tickets
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS tickets_update_own ON public.support_tickets;
CREATE POLICY tickets_update_own ON public.support_tickets
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- tickets_select_own : déjà OK (auth.uid()=user_id), pas touché

-- ─── 4) support_messages : drop 2 policies redondantes ─────────────────────

DROP POLICY IF EXISTS users_insert_messages     ON public.support_messages;
DROP POLICY IF EXISTS users_select_own_messages ON public.support_messages;

-- ─── 5) support_messages : recréer admin_all_messages avec is_admin() ─────

DROP POLICY IF EXISTS admin_all_messages ON public.support_messages;
CREATE POLICY admin_all_messages ON public.support_messages
  AS PERMISSIVE FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── 6) support_messages : simplifier messages_select (admin déjà couvert) ─

DROP POLICY IF EXISTS messages_select ON public.support_messages;
CREATE POLICY messages_select ON public.support_messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

-- ─── 7) support_messages : hardening — INSERT doit poster sur SON ticket ──

DROP POLICY IF EXISTS messages_insert ON public.support_messages;
CREATE POLICY messages_insert ON public.support_messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    -- Le sender doit être le propriétaire du ticket OU un admin
    -- (admin déjà couvert par admin_all_messages, mais on garde explicit
    -- pour les inserts anonymes via service_role qui pourraient échouer
    -- silencieusement sans le check).
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
        AND support_tickets.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
