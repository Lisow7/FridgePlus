-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260516213123) : appliquée
-- sans fichier dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- Elle est en base : ne pas la rejouer.
-- ── SQL du registre, recopié tel quel (md5 a082617635675b52606de3ee653a4618) ──
-- v3.418 — Lock recettes communauté validées (admin only)
--
-- Une fois qu'une recette custom est passée à `moderation_status = 'approved'`
-- (validée par un admin), son contenu (title, data, is_public, statut) ne doit
-- plus être modifiable par l'auteur. Seul un admin peut la rééditer.
--
-- L'auteur reste libre de :
--   - Soft-delete (SET deleted_at = now()) → retire la recette du feed
--     public mais préserve la cohérence (cf. delete_custom_recipe_rgpd)
--   - Toggling deleted_at à null (restauration) si nécessaire
--
-- Le contrôle est fait via trigger BEFORE UPDATE (et pas seulement RLS)
-- car RLS ne peut pas comparer OLD vs NEW. Defense in depth :
--   1. UI cache le bouton Edit (recipe-modal.jsx)
--   2. Guard application (saveCustomRecipe)
--   3. Trigger BD (ici) = source de vérité absolue

CREATE OR REPLACE FUNCTION public.prevent_edit_approved_custom_recipe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin = bypass, peut tout modifier
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  -- Si la recette était déjà approuvée AVANT cet update
  IF OLD.moderation_status = 'approved' THEN
    -- Seules les colonnes deleted_at / restored_at sont modifiables
    -- (soft-delete et restauration par l'auteur). Tout autre changement
    -- est bloqué pour préserver le contenu validé par la modération.
    IF NEW.title              IS DISTINCT FROM OLD.title
       OR NEW.data            IS DISTINCT FROM OLD.data
       OR NEW.is_public       IS DISTINCT FROM OLD.is_public
       OR NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
       OR NEW.consent_to_promote IS DISTINCT FROM OLD.consent_to_promote
    THEN
      RAISE EXCEPTION 'Cannot edit an approved recipe. Only admins can modify approved community recipes.'
        USING ERRCODE = '42501';  -- insufficient_privilege
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_edit_approved_custom_recipe_trigger ON public.custom_recipes;
CREATE TRIGGER prevent_edit_approved_custom_recipe_trigger
  BEFORE UPDATE ON public.custom_recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_edit_approved_custom_recipe();

COMMENT ON FUNCTION public.prevent_edit_approved_custom_recipe() IS
  'v3.418 — Bloque l''édition par l''auteur d''une recette custom passée à moderation_status=approved. Seuls les admins peuvent rééditer. Soft-delete (deleted_at) reste autorisé.';
