-- Corrige les broadcasts admin (« Annonce »/« Maintenance ») qui n'atteignaient
-- jamais les utilisateurs réels.
--
-- Cause : admin_send_notification insérait UNE ligne partagée avec
-- recipient_id=NULL + recipient_role='admin' (CASE WHEN p_recipient_id IS
-- NULL THEN 'admin' ELSE 'user' END). Or la policy RLS notifications_select
-- n'autorise un utilisateur non-admin à lire une ligne recipient_id IS NULL
-- que si recipient_role='admin' AND is_admin() — donc jamais pour un user
-- normal. Les broadcasts n'étaient visibles que dans le feed admin
-- (getAdminFeed, qui lit exactement recipient_id IS NULL + role='admin'),
-- ce qui donnait l'illusion trompeuse que l'envoi avait fonctionné.
--
-- Fix : pas de ligne partagée. Un « Message ciblé » (p_recipient_id fourni)
-- garde son comportement (1 ligne, recipient_role='user'). Un broadcast
-- (p_recipient_id NULL, cas « Annonce »/« Maintenance ») fan-out désormais
-- en 1 ligne par compte actif (recipient_id = id réel), pour que chaque
-- destinataire ait son propre état lu/non-lu — pas de contournement RLS.
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
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_send_notification: permission denied';
  END IF;

  IF p_type IS NULL OR p_type = '' THEN
    RAISE EXCEPTION 'admin_send_notification: p_type is required';
  END IF;

  IF p_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at
    ) VALUES (
      p_recipient_id, 'user', p_type, p_title, p_body,
      COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval
    )
    RETURNING id INTO v_id;
  ELSE
    -- Fan-out : une ligne par compte actif pour la livraison réelle.
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at
    )
    SELECT p.id, 'user', p_type, p_title, p_body,
           COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval
    FROM public.profiles p
    WHERE p.deleted_at IS NULL;

    -- + 1 ligne d'archive admin (recipient_id NULL, role='admin') pour que
    -- le panel admin (getAdminFeed) garde l'historique de ce qui a été
    -- envoyé — comportement déjà existant avant ce fix, préservé ici.
    INSERT INTO public.notifications (
      recipient_id, recipient_role, type, title, body, metadata, expires_at
    ) VALUES (
      NULL, 'admin', p_type, p_title, p_body,
      COALESCE(p_metadata, '{}'::jsonb), now() + (p_expires_days || ' days')::interval
    );
    v_id := NULL;
  END IF;

  RETURN v_id;
END;
$function$;

-- Bonus fix découvert au passage : le bouton « supprimer » du panel admin
-- (adminDeleteNotification, simple DELETE client) n'avait aucune policy
-- l'autorisant sur les lignes recipient_id IS NULL — RLS le bloquait
-- silencieusement (0 ligne affectée), mais l'UI retirait quand même l'item
-- localement (update optimiste), donnant l'illusion que ça avait marché.
CREATE POLICY notifications_delete_admin_broadcast ON public.notifications
FOR DELETE
USING (recipient_id IS NULL AND recipient_role = 'admin' AND is_admin());
