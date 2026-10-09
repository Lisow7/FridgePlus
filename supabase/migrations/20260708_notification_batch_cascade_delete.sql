-- Permet à l'admin de retirer une Annonce/Maintenance de TOUS les
-- destinataires en un clic (au lieu de ne supprimer que sa propre ligne
-- d'archive dans le panel admin, laissant les copies user orphelines).
--
-- batch_id relie toutes les lignes créées par un même envoi
-- (admin_send_notification) : les N copies par utilisateur + la ligne
-- d'archive admin. Suppression = tout le batch d'un coup.
--
-- RGPD : ce ne sont pas des données personnelles d'un utilisateur, c'est
-- un message admin diffusé — le retirer est une rétractation
-- administrative, pas un effacement de droits d'un utilisateur. Par
-- prudence/bonne pratique de traçabilité, l'action est journalisée dans
-- activity_logs (même pattern que les autres actions admin sensibles :
-- anonymize_user, promote_recipe_to_base — append-only, RGPD Art. 30).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_notifications_batch_id
  ON public.notifications (batch_id) WHERE batch_id IS NOT NULL;

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
  ELSE
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at, batch_id
    )
    SELECT p.id, 'user', p_type, p_title, p_body,
           COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval, v_batch_id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL;

    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at, batch_id
    ) VALUES (
      NULL, 'admin', p_type, p_title, p_body,
      COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval, v_batch_id
    );
  END IF;

  RETURN v_batch_id;
END;
$function$;

-- Suppression en cascade : appelée depuis le panel admin sur la ligne
-- d'archive qu'il voit (recipient_id NULL, role='admin'). Si elle a un
-- batch_id, supprime tout le batch (toutes les copies user + l'archive).
-- Sinon (item créé par un trigger, ex. recipe_pending, pas de batch_id) :
-- comportement inchangé, supprime uniquement cette ligne.
CREATE OR REPLACE FUNCTION public.admin_delete_notification_batch(p_notification_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_batch_id     uuid;
  v_recipient_id uuid;
  v_role         text;
  v_deleted      integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_delete_notification_batch: permission denied';
  END IF;

  SELECT batch_id, recipient_id, recipient_role
    INTO v_batch_id, v_recipient_id, v_role
    FROM public.notifications
    WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_delete_notification_batch: notification not found';
  END IF;

  IF v_batch_id IS NOT NULL AND v_recipient_id IS NULL AND v_role = 'admin' THEN
    DELETE FROM public.notifications WHERE batch_id = v_batch_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    DELETE FROM public.notifications WHERE id = p_notification_id;
    v_deleted := 1;
  END IF;

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (
    auth.uid(), 'notification_broadcast_retracted', p_notification_id::text, 'notification_batch',
    jsonb_build_object('batch_id', v_batch_id, 'rows_deleted', v_deleted)
  );

  RETURN json_build_object('deleted', true, 'rows_deleted', v_deleted);
END;
$function$;
