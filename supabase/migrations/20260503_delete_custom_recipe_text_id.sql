-- v3.20.6 — Fix bug suppression définitive recette user
-- ----------------------------------------------------------------------
-- Problème : la signature `delete_custom_recipe_rgpd(p_recipe_id uuid)`
-- (cf. 20260502_recipe_deletion_rgpd.sql) attend un UUID, mais les
-- recettes utilisateurs sont créées côté client avec un identifiant
-- texte au format `custom-${Date.now()}` (cf. createRecipeId() dans
-- src/lib/db/recipes.js).
--
-- Conséquence : tout appel à la RPC échoue avec
--   `invalid input syntax for type uuid: "custom-1777776551328"` (22P02)
-- → l'utilisateur ne peut pas exercer son droit RGPD Art.17 (effacement).
--
-- Fix : aligner la signature sur `text`, comme `count_recipe_references`
-- qui prend déjà text. Le cast UUID interne (ligne `v_recipe_text :=
-- p_recipe_id::text`) disparaît : on utilise directement le param.
--
-- Note schéma : `custom_recipes.id` est de type text (table créée via
-- Dashboard Supabase, cf. `project_db_architecture_decisions.md`),
-- ce qui permet d'accommoder les IDs custom et un futur remplacement
-- par UUID. Si un jour on normalise les IDs en UUID, cette signature
-- text reste compatible (les UUID sont aussi des chaînes valides).

-- DROP de l'ancienne version uuid : sinon Postgres garderait les deux
-- signatures et ce serait ambigu pour les callers. La nouvelle version
-- text reprend tout le corps + grant + comment.
DROP FUNCTION IF EXISTS public.delete_custom_recipe_rgpd(uuid);

CREATE OR REPLACE FUNCTION public.delete_custom_recipe_rgpd(p_recipe_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_favoriters  int := 0;
  v_basket      int := 0;
BEGIN
  -- Vérif existence + propriété
  SELECT user_id INTO v_owner_id
  FROM public.custom_recipes
  WHERE id = p_recipe_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Recipe not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden — not owner' USING ERRCODE = 'P0001';
  END IF;

  -- Compte les références (pour feedback UI + notif aux favoriteurs)
  SELECT COUNT(*) INTO v_favoriters
  FROM public.user_favorites
  WHERE recipe_id = p_recipe_id AND user_id <> v_owner_id;

  SELECT COUNT(*) INTO v_basket
  FROM public.basket_items
  WHERE recipe_id = p_recipe_id;

  -- Notif anonyme à chaque favoriteur (sauf le propriétaire lui-même).
  -- Pas de pseudo de l'auteur, pas de titre de la recette → respect
  -- minimisation / l'auteur exerce son Art.17, sa data ne doit pas être
  -- divulguée à des tiers via cette notif.
  IF v_favoriters > 0 THEN
    INSERT INTO public.notifications
      (recipient_id, recipient_role, type, title, body, expires_at)
    SELECT
      uf.user_id,
      'user',
      'favorite_recipe_deleted',
      jsonb_build_object(
        'fr', 'Une recette favorite a été supprimée',
        'en', 'A favorite recipe was deleted',
        'es', 'Una receta favorita fue eliminada',
        'de', 'Ein Lieblingsrezept wurde gelöscht',
        'ja', 'お気に入りのレシピが削除されました'
      ),
      jsonb_build_object(
        'fr', 'L''auteur a supprimé sa recette définitivement.',
        'en', 'The author permanently deleted their recipe.',
        'es', 'El autor eliminó su receta de forma permanente.',
        'de', 'Der Autor hat sein Rezept dauerhaft gelöscht.',
        'ja', '作成者がレシピを完全に削除しました。'
      ),
      now() + interval '90 days'
    FROM public.user_favorites uf
    WHERE uf.recipe_id = p_recipe_id AND uf.user_id <> v_owner_id;
  END IF;

  -- Log RGPD Art.17 (preuve d'exécution, sans contenu sensible).
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type)
  VALUES (auth.uid(), 'recipe_self_deleted_rgpd', p_recipe_id, 'recipe');

  -- Cascade manuelle (pas de FK strict car recipe_id text accommodant
  -- base_recipes string IDs et custom_recipes).
  DELETE FROM public.user_favorites WHERE recipe_id = p_recipe_id;
  DELETE FROM public.basket_items   WHERE recipe_id = p_recipe_id;

  -- Suppression définitive du row principal.
  DELETE FROM public.custom_recipes WHERE id = p_recipe_id;

  RETURN json_build_object(
    'deleted',              true,
    'favoriters_notified',  v_favoriters,
    'basket_items_removed', v_basket
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_custom_recipe_rgpd(text) TO authenticated;

COMMENT ON FUNCTION public.delete_custom_recipe_rgpd(text) IS
  'Suppression définitive recette user (RGPD Art.17). SECURITY DEFINER : vérifie owner ou admin, notifie favoriteurs anonymement, logge dans activity_logs, supprime cascade user_favorites + basket_items + custom_recipes. v3.20.6 : signature uuid -> text pour accommoder les IDs custom-${timestamp}.';
