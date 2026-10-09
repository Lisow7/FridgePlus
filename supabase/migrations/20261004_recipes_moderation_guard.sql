-- 2026-10-04 — Les colonnes de modération d'une recette communautaire sont
-- réservées à l'admin ; l'emoji et l'image d'une recette sont bornés.
-- Audit du 2026-10-04 : BDD-01, SEC-01 (chaîne critique), SEC-15.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- Les politiques d'écriture de `recipes_unified` ne regardent que le
-- propriétaire :
--     INSERT  WITH CHECK (is_admin() OR (origin = 'community' AND user_id = auth.uid()))
--     UPDATE  idem
-- Aucune colonne n'était exclue, et le seul déclencheur de garde
-- (`prevent_edit_approved_recipe`) ne joue que si l'ANCIEN statut vaut déjà
-- `approved`. Un compte ordinaire pouvait donc écrire lui-même
-- `moderation_status = 'approved'` et `is_public = true` : la politique de
-- lecture servait alors sa recette à tout le monde, visiteurs anonymes compris,
-- sans que la modération l'ait vue.
--
-- Prouvé le 2026-10-04 sur la base de production (bloc DO annulé) : insertion
-- acceptée, recette lue par un anonyme.
--
-- Ce contournement était le premier maillon d'une chaîne : le champ `emoji`,
-- sans contrainte, était inséré sans échappement dans la fiche d'impression
-- (corrigé côté code dans le même lot), et `image_url` pouvait désigner
-- n'importe quel serveur (pixel espion chargé chez chaque visiteur).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. Déclencheur `guard_recipes_moderation_columns` (BEFORE INSERT OR UPDATE).
--    Pour un compte connecté NON admin, sur une recette communautaire :
--      - `moderation_status` ne peut valoir que `private` ou `pending`
--        (création comme modification) — `approved` et `rejected` sont à l'admin ;
--      - `status` est RECALCULÉ, jamais cru : `published` seulement si la recette
--        est déjà approuvée et publique, sinon `draft`. (La colonne a pour défaut
--        `published` : une insertion directe l'héritait.)
--      - `promoted_from_id`, `promoted_at`, `original_author_id`,
--        `original_author_name` sont refusés à la création, figés ensuite ;
--      - `origin` est figé ;
--      - `admin_modified` ne peut pas passer à vrai (il peut repasser à faux :
--        c'est l'auteur qui ferme le bandeau « modifiée par l'admin ») ;
--      - `moderation_reason` ne peut être que conservé ou effacé.
--    Les deux derniers sont RAMENÉS à leur valeur, pas refusés : le client
--    renvoie la ligne entière à chaque enregistrement, et une copie locale en
--    retard ferait échouer une sauvegarde légitime avec un message trompeur.
--
-- 2. Contrainte `recipes_unified_emoji_check` : 16 caractères au plus, aucun
--    de `< > & " '`. Les 515 recettes existantes tiennent en 2 caractères.
--
-- 3. Contrainte `recipes_unified_image_url_check` : vide, ou une adresse du
--    stockage public de CE projet. Les 515 photos existantes y sont déjà.
--
-- Laissent passer sans rien vérifier : l'admin (`is_admin()`), et toute
-- écriture sans utilisateur (`auth.uid()` nul : rôle de service, tâches
-- planifiées, scripts du dépôt). Les recettes officielles ne sont pas
-- concernées : seul un admin peut les écrire (politique), ou une fonction de
-- confiance (`anonymize_user`, qui efface le nom d'un auteur).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE FAIT PAS
--
-- - `ai_moderation_status` reste écrit par le navigateur : c'est une aide pour
--   l'admin, pas une décision. Ne pas s'y fier pour approuver.
-- - Elle ne lie pas l'approbation à une VERSION du contenu : un auteur peut
--   encore modifier une recette `pending` entre le moment où l'admin la lit et
--   celui où il clique « Approuver ». À traiter avec le panneau admin.
-- - Elle ne borne pas la longueur des textes (titre, étapes…) : lot suivant.
--
-- ══════════════════════════════════════════════════════════════════════════
-- COMPATIBILITÉ AVEC LE CLIENT DÉJÀ EN PRODUCTION
--
-- Le formulaire n'envoie que `pending` ou `private`
-- (`use-recipe-form-modal.js`, `migration.js`) ; il renvoie `admin_modified` et
-- `moderation_reason` tels qu'il les a lus (`saveCommunityRecipe`). L'admin
-- passe par `is_admin()`. Cette migration peut donc être appliquée avant la
-- mise en production du code du même lot.
--
-- PREUVE : `supabase/probes/20261004_recipes_moderation_guard.sql`, joué contre
-- la base de production dans un bloc DO terminé par RAISE EXCEPTION (donc
-- annulé) avant l'application. Résultats recopiés en tête de ce fichier-là.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_recipes_moderation_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Écriture sans utilisateur (rôle de service, tâche planifiée) ou admin.
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Une recette officielle ne peut pas être créée par un non-admin : la
    -- politique d'insertion le refuse juste après. Rien à garder ici.
    IF NEW.origin IS DISTINCT FROM 'community' THEN
      RETURN NEW;
    END IF;

    IF COALESCE(NEW.moderation_status, 'private') NOT IN ('private', 'pending')
       OR NEW.promoted_from_id     IS NOT NULL
       OR NEW.promoted_at          IS NOT NULL
       OR NEW.original_author_id   IS NOT NULL
       OR NEW.original_author_name IS NOT NULL
    THEN
      RAISE EXCEPTION 'forbidden: recipe moderation columns are set by an admin'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    NEW.moderation_status := COALESCE(NEW.moderation_status, 'private');
    NEW.status := 'draft';
    RETURN NEW;
  END IF;

  -- UPDATE. Les recettes officielles ne sont modifiées par un non-admin qu'à
  -- travers une fonction de confiance (anonymize_user) : on ne s'en mêle pas.
  IF OLD.origin IS DISTINCT FROM 'community' THEN
    RETURN NEW;
  END IF;

  IF NEW.origin IS DISTINCT FROM OLD.origin
     OR (NEW.moderation_status IS DISTINCT FROM OLD.moderation_status
         AND COALESCE(NEW.moderation_status, 'private') NOT IN ('private', 'pending'))
     OR NEW.promoted_from_id     IS DISTINCT FROM OLD.promoted_from_id
     OR NEW.promoted_at          IS DISTINCT FROM OLD.promoted_at
     OR NEW.original_author_id   IS DISTINCT FROM OLD.original_author_id
     OR NEW.original_author_name IS DISTINCT FROM OLD.original_author_name
  THEN
    RAISE EXCEPTION 'forbidden: recipe moderation columns are set by an admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ramenés, pas refusés (voir l'en-tête).
  IF NEW.admin_modified IS TRUE AND OLD.admin_modified IS NOT TRUE THEN
    NEW.admin_modified := OLD.admin_modified;
  END IF;
  IF NEW.moderation_reason IS NOT NULL
     AND NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason THEN
    NEW.moderation_reason := OLD.moderation_reason;
  END IF;

  NEW.status := CASE
    WHEN NEW.is_public IS TRUE AND NEW.moderation_status = 'approved' THEN 'published'
    ELSE 'draft'
  END;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.guard_recipes_moderation_columns() IS
  'Réserve à l''admin les colonnes de modération d''une recette communautaire (audit 2026-10-04, BDD-01).';

-- Une fonction de déclencheur ne s'appelle pas directement ; on retire tout de
-- même le droit d'exécution par défaut, comme pour les autres gardes.
REVOKE ALL ON FUNCTION public.guard_recipes_moderation_columns() FROM PUBLIC, anon, authenticated;

-- Le nom place ce déclencheur AVANT `prevent_edit_approved_recipe_trigger`
-- (ordre alphabétique) : celui-ci voit donc les valeurs déjà ramenées.
DROP TRIGGER IF EXISTS guard_recipes_moderation_columns_trigger ON public.recipes_unified;
CREATE TRIGGER guard_recipes_moderation_columns_trigger
  BEFORE INSERT OR UPDATE ON public.recipes_unified
  FOR EACH ROW EXECUTE FUNCTION public.guard_recipes_moderation_columns();

ALTER TABLE public.recipes_unified
  DROP CONSTRAINT IF EXISTS recipes_unified_emoji_check,
  DROP CONSTRAINT IF EXISTS recipes_unified_image_url_check;

ALTER TABLE public.recipes_unified
  ADD CONSTRAINT recipes_unified_emoji_check
    CHECK (char_length(emoji) <= 16 AND emoji !~ '[<>&"'']'),
  ADD CONSTRAINT recipes_unified_image_url_check
    CHECK (
      image_url IS NULL
      OR image_url LIKE 'https://bymuvgjghtupfzwjbice.supabase.co/storage/v1/object/public/%'
    );

COMMIT;
