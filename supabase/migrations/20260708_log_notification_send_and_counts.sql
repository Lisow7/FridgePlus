-- Complète la traçabilité (RGPD Art. 30) : la suppression d'un broadcast
-- était déjà journalisée (migration précédente), pas l'envoi — asymétrie.
-- admin_send_notification logue désormais aussi l'action dans activity_logs.
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_type text,
  p_title jsonb,
  p_body jsonb DEFAULT NULL::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_recipient_id uuid DEFAULT NULL::uuid,
  p_expires_days integer DEFAULT 30
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batch_id uuid := gen_random_uuid();
  v_recipients integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_send_notification: permission denied';
  END IF;

  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'admin_send_notification: p_type is required';
  END IF;

  IF p_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at, batch_id
    ) VALUES (
      p_recipient_id, 'user', p_type, p_title, p_body,
      COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval, v_batch_id
    );
    v_recipients := 1;
  ELSE
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at, batch_id
    )
    SELECT p.id, 'user', p_type, p_title, p_body,
           COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval, v_batch_id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL;
    GET DIAGNOSTICS v_recipients = ROW_COUNT;

    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at, batch_id
    ) VALUES (
      NULL, 'admin', p_type, p_title, p_body,
      COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval, v_batch_id
    );
  END IF;

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    auth.uid(), 'notification_sent', v_batch_id::text, 'notification_batch',
    jsonb_build_object('type', p_type, 'targeted', p_recipient_id IS NOT NULL, 'recipients', v_recipients)
  );

  RETURN v_batch_id;
END;
$function$;
