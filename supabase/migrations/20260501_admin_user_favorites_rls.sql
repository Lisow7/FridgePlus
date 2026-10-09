-- RLS admin sur user_favorites
-- ----------------------------------------------------------------------
-- Contexte : la migration 20260430_admin_rls_policies.sql a ajouté des
-- policies admin pour custom_recipes, profiles, activity_logs et
-- ingredient_nutrition, mais a oublié `user_favorites`.
--
-- Conséquence : la fonction adminGetUserProfile() lit `user_favorites`
-- filtré par auth.uid() (policy par défaut "select own"), donc retourne
-- toujours `[]` quand l'admin consulte le profil d'un autre utilisateur.
--
-- Ce patch ajoute une policy SELECT admin via is_admin() pour permettre
-- au panneau admin d'afficher les favoris d'un utilisateur. Idempotent.

DROP POLICY IF EXISTS "user_favorites_select_admin" ON public.user_favorites;
CREATE POLICY "user_favorites_select_admin"
  ON public.user_favorites
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMENT ON POLICY "user_favorites_select_admin" ON public.user_favorites IS
  'Permet aux admins de lire les favoris de tous les utilisateurs (panneau admin → onglet Utilisateurs → bloc Favoris).';
