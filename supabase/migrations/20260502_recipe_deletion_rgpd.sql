-- Suppression définitive recette user — RGPD Article 17
-- ----------------------------------------------------------------------
-- Function SECURITY DEFINER qui orchestre la suppression définitive
-- (hard delete) d'une recette `custom_recipes`, en respectant le RGPD :
--
--   1. Vérification du propriétaire (sauf admin)
--   2. Notif anonyme aux utilisateurs qui avaient cette recette en favori
--      → titre générique "Une recette favorite a été supprimée" (pas de
--      crédit auteur, pas de pseudo, pas de titre de recette divulgué)
--   3. Log RGPD Art.17 dans activity_logs (preuve d'exécution sans
--      contenu sensible — juste action + recipe_id)
--   4. DELETE cascade manuel sur user_favorites + basket_items (pas de
--      FK car recipe_id est text et accommode aussi base_recipes)
--   5. DELETE custom_recipes (le row principal)
--
-- Retourne JSON avec compteurs pour feedback UI :
--   { deleted: true, favoriters_notified: N, basket_items_removed: M }
--
-- Différence avec l'ancienne `deleteCustomRecipe` (soft delete via
-- deleted_at) : ici on supprime DÉFINITIVEMENT. L'ancienne route soft
-- delete reste utilisable pour la modération admin (récupération possible).

CREATE OR REPLACE FUNCTION public.delete_custom_recipe_rgpd(p_recipe_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_recipe_text text;
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

  v_recipe_text := p_recipe_id::text;

  -- Compte les références (pour feedback UI + notif aux favoriteurs)
  SELECT COUNT(*) INTO v_favoriters
  FROM public.user_favorites
  WHERE recipe_id = v_recipe_text AND user_id <> v_owner_id;

  SELECT COUNT(*) INTO v_basket
  FROM public.basket_items
  WHERE recipe_id = v_recipe_text;

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
    WHERE uf.recipe_id = v_recipe_text AND uf.user_id <> v_owner_id;
  END IF;

  -- Log RGPD Art.17 (preuve d'exécution, sans contenu sensible).
  -- À conserver 5 ans selon project_rgpd_compliance.md (le job pg_cron
  -- de purge laissera les entrées flagged comme legal_retention).
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type)
  VALUES (auth.uid(), 'recipe_self_deleted_rgpd', v_recipe_text, 'recipe');

  -- Cascade manuelle (pas de FK strict car recipe_id text accomodatant
  -- base_recipes string IDs et custom_recipes uuid).
  DELETE FROM public.user_favorites WHERE recipe_id = v_recipe_text;
  DELETE FROM public.basket_items   WHERE recipe_id = v_recipe_text;

  -- Suppression définitive du row principal.
  DELETE FROM public.custom_recipes WHERE id = p_recipe_id;

  RETURN json_build_object(
    'deleted',              true,
    'favoriters_notified',  v_favoriters,
    'basket_items_removed', v_basket
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_custom_recipe_rgpd(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_custom_recipe_rgpd(uuid) IS
  'Suppression définitive recette user (RGPD Art.17). SECURITY DEFINER : vérifie owner ou admin, notifie favoriteurs anonymement, logge dans activity_logs, supprime cascade user_favorites + basket_items + custom_recipes.';

-- Helper pour le compteur en preview avant confirmation.
-- Permet à la modale d'afficher "X favoris, Y dans paniers" sans
-- exposer l'identité des favoriteurs (juste un count agrégé).
CREATE OR REPLACE FUNCTION public.count_recipe_references(p_recipe_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_favoriters int := 0;
  v_basket     int := 0;
BEGIN
  SELECT COUNT(*) INTO v_favoriters
  FROM public.user_favorites
  WHERE recipe_id = p_recipe_id;

  SELECT COUNT(*) INTO v_basket
  FROM public.basket_items
  WHERE recipe_id = p_recipe_id;

  RETURN json_build_object(
    'favoriters', v_favoriters,
    'basket',     v_basket
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_recipe_references(text) TO authenticated;

COMMENT ON FUNCTION public.count_recipe_references(text) IS
  'Retourne {favoriters, basket} pour une recette donnée. Sécurité : ne révèle aucune identité, juste des comptes agrégés.';
