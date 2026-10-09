-- ============================================================
-- v0.16.x — Refonte BDD Sprint 2 — Promote my 5 partial FK indexes → FULL
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Correctif PR-DB-05 :
-- J'avais créé des indexes partiels `WHERE col IS NOT NULL` sur les FK
-- nullable, pensant économiser de l'espace. En réalité Postgres exclut
-- déjà les NULL des B-tree par défaut, donc le `WHERE` n'apporte rien,
-- et l'advisor `unindexed_foreign_keys` continue de flagger ces FK car
-- les indexes partiels ne couvrent pas les CASCADE DELETE/UPDATE.
--
-- DROP des 5 partial créés par PR-DB-05 + recréation en FULL index.
--
-- Hors scope (à traiter dans une future PR) : 6 partial indexes
-- pré-existants (idx_base_recipes_promoted_from, idx_community_posts_user,
-- idx_community_replies_post/user, custom_recipes_user_id_idx,
-- idx_notifications_recipient_unread). On ne les touche pas ici pour
-- éviter de casser des queries qui pourraient en dépendre.
-- ============================================================

BEGIN;

-- ─── base_recipes.original_author_id ─────────────────────────────────────────
DROP INDEX IF EXISTS public.base_recipes_original_author_id_idx;
CREATE INDEX base_recipes_original_author_id_idx
  ON public.base_recipes(original_author_id);

-- ─── ingredients.group_id ────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.ingredients_group_id_idx;
CREATE INDEX ingredients_group_id_idx
  ON public.ingredients(group_id);

-- ─── special_access.revoked_by ───────────────────────────────────────────────
DROP INDEX IF EXISTS public.special_access_revoked_by_idx;
CREATE INDEX special_access_revoked_by_idx
  ON public.special_access(revoked_by);

-- ─── subscription_events.granted_by ──────────────────────────────────────────
DROP INDEX IF EXISTS public.subscription_events_granted_by_idx;
CREATE INDEX subscription_events_granted_by_idx
  ON public.subscription_events(granted_by);

-- ─── support_messages.sender_id ──────────────────────────────────────────────
DROP INDEX IF EXISTS public.support_messages_sender_id_idx;
CREATE INDEX support_messages_sender_id_idx
  ON public.support_messages(sender_id);

COMMIT;
