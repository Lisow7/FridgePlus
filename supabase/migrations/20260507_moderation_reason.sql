-- Migration 20260507_moderation_reason
-- ─────────────────────────────────────────────────────────────────────────────
-- Ajoute la colonne `moderation_reason` à `custom_recipes` et enrichit le
-- trigger de notification pour inclure la raison dans le message envoyé
-- au propriétaire de la recette.
--
-- RGPD :
--   • La raison est une donnée textuelle non-sensible (pas de PII).
--   • Elle est purgée automatiquement si le compte est anonymisé
--     (CASCADE via user_id sur la table custom_recipes).
--   • Elle est visible uniquement par l'admin (RLS custom_recipes) et
--     le propriétaire de la recette (via la notification).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Colonne nullable — null = raison non renseignée (cas approbation simple)
ALTER TABLE public.custom_recipes
  ADD COLUMN IF NOT EXISTS moderation_reason text;

COMMENT ON COLUMN public.custom_recipes.moderation_reason IS
  'Raison de la décision de modération (refus, attente, approbation avec message). Optionnelle. Saisie par l''admin au moment du changement de statut.';

-- 2. Mise à jour du trigger notify_recipe_status_changed
--    Enrichit le body de la notification avec la raison quand elle est présente.
--    Ajoute le cas 'pending' (remise en attente avec justificatif).
CREATE OR REPLACE FUNCTION public.notify_recipe_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  jsonb;
  v_body   jsonb;
  v_type   text;
  v_reason text;
BEGIN
  -- Seulement si le statut a changé
  IF NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  v_reason := NULLIF(TRIM(COALESCE(NEW.moderation_reason, '')), '');

  IF NEW.moderation_status = 'approved' THEN
    v_type  := 'recipe_approved';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été approuvée 🎉',
      'en', 'Your recipe has been approved 🎉',
      'es', '¡Tu receta ha sido aprobada 🎉!',
      'de', 'Dein Rezept wurde genehmigt 🎉',
      'ja', 'レシピが承認されました 🎉'
    );
    -- Body = titre recette + message optionnel de l'admin
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', NEW.title || ' — ' || v_reason,
        'en', NEW.title || ' — ' || v_reason,
        'es', NEW.title || ' — ' || v_reason,
        'de', NEW.title || ' — ' || v_reason,
        'ja', NEW.title || ' — ' || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', NEW.title,
        'en', NEW.title,
        'es', NEW.title,
        'de', NEW.title,
        'ja', NEW.title
      );
    END IF;

  ELSIF NEW.moderation_status = 'rejected' THEN
    v_type  := 'recipe_rejected';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été refusée',
      'en', 'Your recipe was declined',
      'es', 'Tu receta fue rechazada',
      'de', 'Dein Rezept wurde abgelehnt',
      'ja', 'レシピが却下されました'
    );
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', NEW.title || ' — Motif : ' || v_reason,
        'en', NEW.title || ' — Reason: '  || v_reason,
        'es', NEW.title || ' — Motivo: '  || v_reason,
        'de', NEW.title || ' — Grund: '   || v_reason,
        'ja', NEW.title || ' — 理由：'     || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', NEW.title,
        'en', NEW.title,
        'es', NEW.title,
        'de', NEW.title,
        'ja', NEW.title
      );
    END IF;

  ELSIF NEW.moderation_status = 'pending' AND OLD.moderation_status != 'pending' THEN
    -- Remise en attente initiée par l'admin (ex : corrections demandées)
    v_type  := 'recipe_pending_correction';
    v_title := jsonb_build_object(
      'fr', 'Des corrections sont demandées pour ta recette',
      'en', 'Corrections are requested for your recipe',
      'es', 'Se solicitan correcciones para tu receta',
      'de', 'Korrekturen für dein Rezept wurden angefordert',
      'ja', 'レシピに修正が必要です'
    );
    IF v_reason IS NOT NULL THEN
      v_body := jsonb_build_object(
        'fr', NEW.title || ' — ' || v_reason,
        'en', NEW.title || ' — ' || v_reason,
        'es', NEW.title || ' — ' || v_reason,
        'de', NEW.title || ' — ' || v_reason,
        'ja', NEW.title || ' — ' || v_reason
      );
    ELSE
      v_body := jsonb_build_object(
        'fr', NEW.title,
        'en', NEW.title,
        'es', NEW.title,
        'de', NEW.title,
        'ja', NEW.title
      );
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'user',
    v_type,
    v_title,
    v_body,
    '/recipes/' || NEW.id::text,
    jsonb_build_object('recipe_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Recréer le trigger (remplace l'ancienne version)
DROP TRIGGER IF EXISTS trg_notify_recipe_status_changed ON public.custom_recipes;
CREATE TRIGGER trg_notify_recipe_status_changed
AFTER UPDATE ON public.custom_recipes
FOR EACH ROW
EXECUTE FUNCTION public.notify_recipe_status_changed();
