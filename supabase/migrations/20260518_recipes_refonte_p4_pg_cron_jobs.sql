-- ============================================================
-- v0.16.x — Refonte Recettes Phase 4 — pg_cron jobs
-- ------------------------------------------------------------
-- 2 jobs cron pour automatiser le pipeline d'import :
--   1. auto-revalidate : re-run validators sur staging 'pending' chaque heure
--      (catalogue ingredients peut avoir changé, admin a corrigé un orphan, etc.)
--      Implémenté côté SQL via fonction qui réécrit errors basée sur stat actuel.
--      Note : la version JS du pipeline est plus puissante mais nécessite Edge
--      Function. Cette V1 SQL minimaliste détecte juste les ingredient_orphan
--      résolus depuis le dernier check.
--
--   2. cleanup-rejected : DELETE staging status='rejected' > 90 jours
--      (RGPD minimisation, permet contestation 3 mois)
--
-- Pas d'auto-publish (sécurité) : admin valide explicitement chaque recette
-- via Admin UI Qualité v3 (Phase 5).
--
-- Spec source : la conception « recipes-massive-import-and-validation » du 2026-05-18 (section 2 D12)
-- ============================================================

BEGIN;

-- ─── Fonction : recheck orphans (résolus depuis dernier check) ───────────────
-- Pour chaque staging 'invalid' avec INGREDIENT_ORPHAN_REQUIRED dans errors,
-- vérifie si l'ingrédient existe maintenant. Si OUI, retire l'erreur du jsonb.
-- Si plus aucune erreur blocking → status='pending' (admin review next).

CREATE OR REPLACE FUNCTION public.recipe_imports_recheck_orphans()
RETURNS TABLE(staging_id uuid, errors_removed int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
DECLARE
  v_staging record;
  v_filtered_errors jsonb;
  v_removed int;
  v_still_blocking boolean;
BEGIN
  FOR v_staging IN
    SELECT s.id, s.errors
    FROM recipe_imports_staging s
    WHERE s.status = 'invalid'
      AND jsonb_typeof(s.errors) = 'array'
      AND s.errors @> '[{"code":"INGREDIENT_ORPHAN_REQUIRED"}]'::jsonb
    LIMIT 100  -- batch pour ne pas bloquer la BDD
  LOOP
    -- Filtre : garde seulement les erreurs dont l'ingrédient n'existe TOUJOURS pas
    SELECT
      COALESCE(jsonb_agg(err), '[]'::jsonb),
      COUNT(*) FILTER (WHERE NOT keep) - 0
    INTO v_filtered_errors, v_removed
    FROM (
      SELECT
        err,
        CASE
          WHEN err->>'code' IN ('INGREDIENT_ORPHAN_REQUIRED', 'INGREDIENT_ORPHAN_OPTIONAL')
            AND (err->>'raw') IS NOT NULL
            AND EXISTS (SELECT 1 FROM ingredients i WHERE i.id = (err->>'raw'))
          THEN false  -- on retire cette erreur (ingrédient résolu)
          ELSE true   -- on garde
        END AS keep
      FROM jsonb_array_elements(v_staging.errors) err
    ) t
    WHERE keep;

    IF v_removed > 0 THEN
      -- Détermine si encore au moins 1 erreur blocking
      SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_filtered_errors) e
        WHERE e->>'severity' = 'blocking'
      ) INTO v_still_blocking;

      UPDATE recipe_imports_staging
      SET errors = v_filtered_errors,
          status = CASE WHEN v_still_blocking THEN 'invalid' ELSE 'pending' END
      WHERE id = v_staging.id;

      -- Log événement
      INSERT INTO recipe_import_events (staging_id, event_type, payload)
      VALUES (
        v_staging.id,
        'revalidated',
        jsonb_build_object('source', 'pg_cron_recheck_orphans', 'removed_count', v_removed)
      );

      staging_id := v_staging.id;
      errors_removed := v_removed;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recipe_imports_recheck_orphans() FROM anon, authenticated, PUBLIC;

-- ─── pg_cron jobs ────────────────────────────────────────────────────────────
-- Job 1 : recheck orphans chaque heure
SELECT cron.schedule(
  'recipe-imports-recheck-orphans',
  '0 * * * *',  -- chaque heure pile
  $$ SELECT public.recipe_imports_recheck_orphans() $$
);

-- Job 2 : cleanup staging 'rejected' > 90 jours (RGPD)
SELECT cron.schedule(
  'recipe-imports-cleanup-rejected',
  '0 4 * * 0',  -- dimanche 4h
  $$
    DELETE FROM public.recipe_imports_staging
    WHERE status = 'rejected'
      AND resolved_at < now() - interval '90 days'
  $$
);

COMMIT;
