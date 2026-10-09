-- ============================================================
-- v0.16.x — Refonte BDD Sprint 2 — Add missing FK indexes (PR-DB-05)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
-- Findings advisors : `project_db_advisors_findings_2026_05_17.md`
--
-- Élimine les 13 advisors WARN `unindexed_foreign_keys` :
-- chaque FK sans index couvrant ralentit les jointures, les cascades
-- DELETE/UPDATE, et empêche le planner de l'utiliser pour le routing.
--
-- Pattern : `CREATE INDEX IF NOT EXISTS <name> ON <table>(<fk_col>)`.
-- Idempotent. Hors d'une transaction explicite — chaque CREATE INDEX est
-- déjà atomique. Pas de CONCURRENTLY ici car les tables sont petites
-- (< 1000 rows toutes confondues) et `apply_migration` Supabase tourne
-- en transaction par défaut, ce qui interdit CONCURRENTLY.
--
-- Convention nommage : `<table>_<col>_idx` (cohérent avec Supabase défaut).
-- ============================================================

BEGIN;

-- ─── activity_logs ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx
  ON public.activity_logs(user_id);

-- ─── base_recipes (3 FK) ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS base_recipes_difficulty_idx
  ON public.base_recipes(difficulty);
CREATE INDEX IF NOT EXISTS base_recipes_original_author_id_idx
  ON public.base_recipes(original_author_id)
  WHERE original_author_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS base_recipes_type_idx
  ON public.base_recipes(type);

-- ─── community_blocks ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS community_blocks_blocked_user_id_idx
  ON public.community_blocks(blocked_user_id);

-- ─── ingredients ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ingredients_group_id_idx
  ON public.ingredients(group_id)
  WHERE group_id IS NOT NULL;

-- ─── special_access (2 FK) ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS special_access_granted_by_idx
  ON public.special_access(granted_by);
CREATE INDEX IF NOT EXISTS special_access_revoked_by_idx
  ON public.special_access(revoked_by)
  WHERE revoked_by IS NOT NULL;

-- ─── subscription_events (2 FK) ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS subscription_events_granted_by_idx
  ON public.subscription_events(granted_by)
  WHERE granted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_events_user_id_idx
  ON public.subscription_events(user_id);

-- ─── support_messages (2 FK) ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS support_messages_sender_id_idx
  ON public.support_messages(sender_id)
  WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx
  ON public.support_messages(ticket_id);

-- ─── support_tickets ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx
  ON public.support_tickets(user_id);

COMMIT;
