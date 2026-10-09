-- Fonction sécurisée (SECURITY DEFINER) pour permettre à l'admin
-- de lire l'email et la dernière connexion depuis auth.users.
-- Accessible uniquement si le compte appelant a role = 'admin' dans profiles.

CREATE OR REPLACE FUNCTION admin_get_auth_users()
RETURNS TABLE(id uuid, email text, last_sign_in_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT au.id, au.email, au.last_sign_in_at
  FROM auth.users au
  WHERE EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION admin_get_auth_users() TO authenticated;
