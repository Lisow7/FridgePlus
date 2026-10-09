-- Ajoute la colonne `password_changed_at` sur `profiles` pour tracer la
-- dernière modification du mot de passe — affichée dans la modale
-- « Mon profil → Identité ».
--
-- Source d'écriture : Edge Function `confirm-password-change` (étape 2
-- du flow OTP) met `password_changed_at = now()` après l'application
-- réussie du nouveau mdp. La voie « Mot de passe oublié » n'a pas accès
-- à ce hook — elle utilise auth.updateUser et ne met PAS à jour la
-- colonne ; à terme on pourra brancher un trigger sur auth.users si
-- besoin (hors scope de cette PR).
--
-- Backfill : pour les comptes déjà existants, on prend la date de
-- création du compte auth (= moment où le mdp a été défini la première
-- fois). Idempotent grâce à `WHERE password_changed_at IS NULL`.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Backfill pour comptes existants
UPDATE public.profiles p
SET password_changed_at = u.created_at
FROM auth.users u
WHERE p.id = u.id
  AND p.password_changed_at IS NULL;

-- Default pour les nouveaux comptes (le trigger handle_new_user qui
-- crée la ligne profile prendra ce default si rien n'est passé).
ALTER TABLE public.profiles
  ALTER COLUMN password_changed_at SET DEFAULT now();

COMMENT ON COLUMN public.profiles.password_changed_at IS
  'Timestamp de la dernière modification réussie du mot de passe via la modale Profil (Edge Function confirm-password-change). Backfillé à auth.users.created_at pour les comptes pré-existants.';
