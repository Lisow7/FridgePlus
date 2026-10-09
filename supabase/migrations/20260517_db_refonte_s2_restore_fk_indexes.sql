-- ============================================================
-- v0.16.x — Refonte BDD Sprint 2 — Restore FK indexes (PR-DB-05b correctif)
-- ------------------------------------------------------------
-- Plan ERD : la note interne « ERD cible du 2026-05-17 »
--
-- Correctif PR-DB-04 + PR-DB-05 :
-- L'advisor `unused_index` avait flaggé 2 indexes comme inutilisés (idx_scan=0)
-- alors qu'ils couvrent en réalité des FK. Le drop a éliminé l'index FK,
-- ce qui ralentit les cascade DELETE/UPDATE sur les tables parentes même
-- si le SELECT direct n'est pas utilisé.
--
-- Recréation des 2 indexes FK dropés à tort + ajout de `base_recipes.country`
-- qui n'avait jamais eu d'index couvrant.
-- ============================================================

BEGIN;

-- ─── Recréer les 2 indexes FK dropés à tort en PR-DB-04 ─────────────────────

-- post_reactions.post_id : indispensable pour CASCADE DELETE de community_posts
CREATE INDEX IF NOT EXISTS post_reactions_post_id_idx
  ON public.post_reactions(post_id);

-- community_replies.parent_reply_id : indispensable pour self-ref CASCADE
CREATE INDEX IF NOT EXISTS community_replies_parent_reply_id_idx
  ON public.community_replies(parent_reply_id);

-- ─── Ajouter le FK index manquant historique ─────────────────────────────────

-- base_recipes.country : FK vers countries_master sans index
CREATE INDEX IF NOT EXISTS base_recipes_country_idx
  ON public.base_recipes(country);

COMMIT;
