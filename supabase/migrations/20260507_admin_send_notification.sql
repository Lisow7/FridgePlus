-- Migration 20260507_admin_send_notification
-- Ajoute la RPC `admin_send_notification` permettant à un admin d'insérer
-- une notification sans passer par les triggers automatiques.
--
-- Deux modes :
--   • Broadcast user  → recipient_role = 'user', recipient_id = p_recipient_id
--   • Broadcast admin → recipient_role = 'admin', recipient_id = NULL
--
-- RGPD : la fonction vérifie is_admin() avant tout INSERT.
-- Les notifications sont purgées automatiquement après expires_at
-- via le job pg_cron défini dans 20260503_pg_cron_purges.sql.

CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_type         text,
  p_title        jsonb,
  p_body         jsonb        DEFAULT NULL,
  p_metadata     jsonb        DEFAULT '{}'::jsonb,
  p_recipient_id uuid         DEFAULT NULL,
  p_expires_days int          DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Autorisation admin obligatoire
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_send_notification: permission denied';
  END IF;

  -- Validation du type (liste ouverte mais non vide)
  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'admin_send_notification: p_type is required';
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    recipient_role,
    type,
    title,
    body,
    metadata,
    expires_at
  ) VALUES (
    p_recipient_id,
    CASE WHEN p_recipient_id IS NULL THEN 'admin' ELSE 'user' END,
    p_type,
    p_title,
    p_body,
    COALESCE(p_metadata, '{}'::jsonb),
    now() + (p_expires_days || ' days')::interval
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Révoquer toute exécution publique — seuls les admins authentifiés peuvent
-- appeler via la vérification is_admin() interne.
REVOKE EXECUTE ON FUNCTION public.admin_send_notification FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_send_notification TO authenticated;

COMMENT ON FUNCTION public.admin_send_notification IS
  'Envoie une notification depuis le panel admin. recipient_id NULL = broadcast admin ; sinon notif ciblée user. Vérifie is_admin() en interne.';
