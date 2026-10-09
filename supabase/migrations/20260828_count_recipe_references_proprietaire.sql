-- `count_recipe_references` ne répond plus que sur SES propres recettes.
--
-- Trouvé à l'audit du 2026-08-28 : c'était la seule fonction SECURITY DEFINER
-- du schéma sans aucun garde dans son corps (17 sur 18 en avaient un). Étant
-- SECURITY DEFINER, elle contourne la RLS — n'importe quel compte connecté
-- pouvait donc demander, pour N'IMPORTE QUELLE recette, combien de personnes
-- l'ont en favori et combien l'ont au panier.
--
-- Enjeu réel : modeste (des totaux agrégés, aucune donnée personnelle), mais
-- c'est une mesure d'audience du produit exposée à tout compte, et l'écart
-- avec les 17 autres fonctions n'était ni voulu ni documenté. Le commentaire
-- de son appelant JS affirmait d'ailleurs « wrappers RPC déjà sécurisés côté
-- SQL » — un commentaire qui annonçait l'inverse du code.
--
-- ⚠️ Le garde N'EST PAS `is_admin()` : cette fonction sert à l'utilisateur qui
-- supprime SA recette (`recipe-delete-confirm-modal`), pour lui dire ce qu'il
-- s'apprête à retirer aux autres. Le bon garde est la PROPRIÉTÉ.
--
-- Elle reste SECURITY DEFINER à dessein : compter les favoris d'autrui exige
-- précisément de dépasser la RLS de `user_favorites`. On borne donc l'accès
-- par le propriétaire de la recette plutôt qu'en retirant le privilège.
--
-- Dégradation choisie : des zéros plutôt qu'une exception. L'appelant est une
-- modale de confirmation de suppression ; la faire échouer empêcherait un
-- utilisateur de supprimer sa recette, ce qui serait un défaut plus grave que
-- celui qu'on corrige.

create or replace function public.count_recipe_references(p_recipe_id text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_favoriters int := 0;
  v_basket     int := 0;
  v_autorise   boolean := false;
BEGIN
  -- Autorisé si : admin, OU écriture serveur (service_role, pas d'auth.uid()),
  -- OU la recette appartient à l'appelant.
  SELECT
    public.is_admin()
    OR (SELECT auth.uid()) IS NULL
    OR EXISTS (
      SELECT 1 FROM public.recipes_unified r
      WHERE r.id = p_recipe_id
        AND r.user_id = (SELECT auth.uid())
    )
  INTO v_autorise;

  IF NOT v_autorise THEN
    RETURN json_build_object('favoriters', 0, 'basket', 0);
  END IF;

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
$function$;
