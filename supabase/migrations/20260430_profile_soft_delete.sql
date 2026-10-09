-- ============================================================
-- Soft delete des comptes utilisateur (rétention 30 jours)
-- ------------------------------------------------------------
-- Au lieu d'un DELETE immédiat de auth.users + cascade, on marque le
-- profil comme « en attente de suppression » via deleted_at = now().
-- Pendant 30 jours, le user peut annuler la suppression :
--   • Soit en se reconnectant (l'app réinitialise deleted_at = NULL)
--   • Soit via le lien restore_token reçu par email
--
-- Au-delà de 30 jours, une Edge Function purge appelée par CRON
-- (cron-job.org → POST /functions/v1/purge-soft-deleted-accounts avec
-- header Authorization: Bearer PURGE_CRON_SECRET) effectue la
-- suppression définitive via auth.admin.deleteUser, qui cascade sur
-- toutes les tables applicatives.
--
-- Schéma :
--   • deleted_at    TIMESTAMPTZ NULL → date du soft-delete (NULL = compte actif)
--   • restore_token UUID        NULL → token unique pour le lien email de
--                                       restauration (NULL en temps normal)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restore_token UUID;

-- Index pour la requête CRON (purge des comptes > 30 jours) et pour le
-- lookup par token lors d'un clic sur le lien email.
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_restore_token
  ON public.profiles(restore_token)
  WHERE restore_token IS NOT NULL;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'Timestamp du soft-delete. NULL = compte actif. Les comptes avec deleted_at < now() - 30 jours sont purgés par la fonction CRON purge-soft-deleted-accounts.';

COMMENT ON COLUMN public.profiles.restore_token IS
  'Token unique généré au soft-delete pour le lien email de restauration. Effacé quand le user restaure (auto via signin ou via lien).';
