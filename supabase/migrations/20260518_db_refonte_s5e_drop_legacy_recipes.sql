-- ============================================================
-- v0.16.x — Refonte BDD Sprint 5e — DROP base_recipes_legacy + custom_recipes_legacy
-- ------------------------------------------------------------
-- Finalise le Sprint 5. Les 2 tables legacy ont été RENAMED en Sprint 5d
-- et n'ont plus aucun write actif depuis (sync triggers droppés). Elles
-- étaient conservées comme filet de sécurité pendant le soak window.
--
-- Pré-vérifs faites avant cette migration :
--   - PR S5d + S7b + S7c + S7d mergées sur dev + en prod
--   - Smoke Vercel preview verts (anon + authenticated paths)
--   - `grep base_recipes_legacy|custom_recipes_legacy src/` → 0 hit
--     (sauf src/shared/types/database.ts auto-généré, sera regénéré ici)
--   - Audit data parity : 100% des keys du jsonb `data` legacy sont :
--       a) Déjà colonnes structurées sur recipes_unified (is_public,
--          moderation_status, consent_to_promote) → reconstructibles
--       b) Ou sémantiquement obsolètes (`isCustom` flag = redondant
--          avec origin='community')
--     → ZÉRO perte de donnée business.
--
-- Élimine 18 multiple_permissive_policies lints (12 custom + 10 base
-- legacy) et 4 unused_index sur base_recipes_legacy.
--
-- Rollback plan d'urgence :
--   1) Re-créer les tables depuis recipes_unified :
--      CREATE TABLE base_recipes AS
--        SELECT id, name, emoji, time_min, ..., promoted_at
--        FROM recipes_unified WHERE origin='official';
--      CREATE TABLE custom_recipes AS
--        SELECT id, user_id, title, jsonb_build_object(...) as data, ...
--        FROM recipes_unified WHERE origin='community';
--   2) Recréer les policies (cf. historique git)
--   3) MAIS : les VIEWS recipes_unified (base_recipes/custom_recipes)
--      ont les MÊMES noms → conflit. Donc rollback nécessite aussi
--      DROP VIEWs puis CREATE TABLEs avec data légère depuis pg_dump.
--
-- Le scénario "rollback nécessaire" est très improbable :
--   - 4 PRs mergées sans bug remonté
--   - Smoke tests verts à chaque étape
--   - Code app inchangé sauf 3 .upsert→.insert
-- ============================================================

BEGIN;

-- ─── 1) DROP custom_recipes_legacy + ses policies ──────────────────────────
-- CASCADE pour drop les éventuels objets dépendants encore attachés.
DROP TABLE IF EXISTS public.custom_recipes_legacy CASCADE;

-- ─── 2) DROP base_recipes_legacy + ses policies ────────────────────────────
DROP TABLE IF EXISTS public.base_recipes_legacy CASCADE;

COMMIT;
