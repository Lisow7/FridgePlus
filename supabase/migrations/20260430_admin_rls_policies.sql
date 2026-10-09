-- ============================================================
-- RLS admin — fonction is_admin() SECURITY DEFINER
-- ------------------------------------------------------------
-- Contexte : les anciennes policies admin sur profiles avaient été supprimées
-- car elles déclenchaient une récursion RLS (la policy SELECT sur profiles
-- consultait profiles, qui re-déclenchait la policy → infinite loop).
--
-- Solution : encapsuler la vérification dans une fonction SECURITY DEFINER.
-- La fonction s'exécute avec les droits de son propriétaire (qui contourne
-- RLS), ce qui casse la boucle. La fonction est marquée STABLE pour que
-- Postgres puisse la mettre en cache pendant la requête.
--
-- Effet : l'admin peut désormais voir et modifier toutes les recettes
-- communautaires en attente, et lire les profils des autres utilisateurs.
-- ============================================================

-- ── Helper : is_admin() ──────────────────────────────────────
-- Renvoie true si l'utilisateur courant a le role 'admin' dans profiles.
-- SECURITY DEFINER : exécutée avec les droits du propriétaire (postgres),
-- ce qui contourne RLS et évite la récursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── custom_recipes : admin peut tout voir et modérer ────────
-- Avant : seul le propriétaire pouvait SELECT/UPDATE → l'admin ne voyait
-- pas les recettes "pending" des autres utilisateurs.
-- Après : l'admin peut SELECT toutes les recettes (même soft-deleted) et
-- UPDATE pour approuver / rejeter / éditer.

DROP POLICY IF EXISTS "custom_recipes_select_admin" ON public.custom_recipes;
CREATE POLICY "custom_recipes_select_admin"
  ON public.custom_recipes
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "custom_recipes_update_admin" ON public.custom_recipes;
CREATE POLICY "custom_recipes_update_admin"
  ON public.custom_recipes
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- (DELETE volontairement non couvert : on préfère soft-delete via
-- adminUpdateCommunityRecipe ou suppression côté propriétaire.)

-- ── profiles : admin peut lister et bannir ───────────────────
-- Permet au panneau admin d'afficher tous les utilisateurs et de modifier
-- leur statut (banned, role…).

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── activity_logs : admin peut lire les logs ─────────────────
-- Si la table existe et a RLS activée, l'admin doit pouvoir auditer
-- les actions des autres users.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_logs'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "activity_logs_select_admin" ON public.activity_logs';
    EXECUTE 'CREATE POLICY "activity_logs_select_admin"
      ON public.activity_logs
      FOR SELECT
      TO authenticated
      USING (public.is_admin())';
  END IF;
END $$;

-- ── ingredient_nutrition : fix policy admin cassée ───────────
-- L'ancienne policy "nutrition_admin_write" (migration nutrition) référence
-- une colonne `is_admin` qui n'existe pas sur profiles (seule `role` existe).
-- On la remplace par un appel à is_admin() qui matche le vrai schéma.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ingredient_nutrition'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "nutrition_admin_write" ON public.ingredient_nutrition';
    EXECUTE 'CREATE POLICY "nutrition_admin_write"
      ON public.ingredient_nutrition
      FOR ALL
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin())';
  END IF;
END $$;

-- ── Commentaires ─────────────────────────────────────────────
COMMENT ON FUNCTION public.is_admin() IS
  'Renvoie true si l''utilisateur authentifié courant a le role admin. SECURITY DEFINER pour éviter la récursion RLS sur profiles.';
