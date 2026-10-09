-- Garantit l'unicité du pseudo (case-insensitive) dans profiles.
-- L'utilisateur peut désormais modifier son pseudo depuis Mon profil — la
-- contrainte assure qu'il ne peut pas prendre un pseudo déjà utilisé par
-- un autre compte.
--
-- Si la contrainte existe déjà (créée manuellement via le dashboard
-- Supabase), le DO BLOCK l'ignore silencieusement.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname  = 'profiles_username_unique_lower'
  ) THEN
    CREATE UNIQUE INDEX profiles_username_unique_lower
      ON public.profiles (lower(username))
      WHERE username IS NOT NULL;
  END IF;
END $$;
