-- Table notifications + RLS + triggers
-- ----------------------------------------------------------------------
-- Cible double :
--   • Notifs user (recipient_id = uuid d'un user)  → cloche dans le header
--   • Notifs admin broadcast (recipient_id NULL)   → section admin
--
-- Sécurité RGPD :
--   • RLS strict : user voit uniquement ses propres notifs ; admin voit
--     ses propres + les broadcast admin (recipient_id IS NULL)
--   • metadata jsonb avec whitelist applicative (jamais email/IP — voir
--     project_security_hardening.md)
--   • expires_at pour purge auto (job pg_cron au sprint 8) — défaut :
--     90 jours après création (override possible par trigger)
--
-- Triggers (insertions atomiques sur events) :
--   • support_messages INSERT WHERE is_admin = true
--     → notif type 'ticket_reply' au propriétaire du ticket
--   • custom_recipes INSERT WHERE moderation_status = 'pending'
--     → notif type 'recipe_pending' broadcast aux admins
--   • custom_recipes UPDATE WHERE moderation_status changes
--     → notif type 'recipe_approved' / 'recipe_rejected' au propriétaire
--
-- Idempotente.

-- ─── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_role text CHECK (recipient_role IN ('user', 'admin')) NOT NULL DEFAULT 'user',
  type          text NOT NULL,
  title         jsonb NOT NULL,
  body          jsonb,
  link          text,
  metadata      jsonb DEFAULT '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

-- Contraintes :
--   • si recipient_role = 'user', recipient_id doit être non null
--   • si recipient_role = 'admin', recipient_id peut être null (broadcast)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_has_recipient;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_has_recipient
  CHECK (recipient_role = 'admin' OR recipient_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, read_at) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_admin_broadcast
  ON public.notifications (created_at DESC) WHERE recipient_id IS NULL AND recipient_role = 'admin';
CREATE INDEX IF NOT EXISTS idx_notifications_expires
  ON public.notifications (expires_at);

COMMENT ON TABLE public.notifications IS
  'Notifications utilisateur et admin. recipient_id NULL + recipient_role = admin = broadcast à tous les admins. Purge auto après expires_at via pg_cron (sprint 8).';

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT : user voit ses propres ; admin voit ses propres + les broadcast admin
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR (recipient_id IS NULL AND recipient_role = 'admin' AND public.is_admin())
  );

-- UPDATE : seul le destinataire peut marquer lu / non lu (sa propre notif)
-- Pour les broadcast admin, chaque admin peut indépendamment marquer lu via
-- une table parallèle (futur — pour l'instant les broadcast admin sont
-- partagés en lecture, l'état "lu" d'un admin n'affecte pas les autres)
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- DELETE : seul le destinataire peut supprimer la sienne
DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (recipient_id = auth.uid());

-- INSERT : aucune insertion directe par l'app (sécurité). Les triggers
-- ci-dessous tournent en SECURITY DEFINER et insèrent au nom de la table.
-- Service role peut aussi insérer via Edge Function pour les notifs custom.
DROP POLICY IF EXISTS "notifications_no_insert_client" ON public.notifications;
CREATE POLICY "notifications_no_insert_client"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ─── Trigger 1 : réponse admin sur ticket → notif user ──────────────────────

CREATE OR REPLACE FUNCTION public.notify_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket  record;
  v_title   jsonb;
BEGIN
  -- Seulement si le message est de l'admin
  IF NEW.is_admin IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT id, user_id, title INTO v_ticket
  FROM public.support_tickets
  WHERE id = NEW.ticket_id;

  IF v_ticket IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := jsonb_build_object(
    'fr', 'Nouvelle réponse à ton ticket',
    'en', 'New reply to your ticket',
    'es', 'Nueva respuesta a tu ticket',
    'de', 'Neue Antwort auf dein Ticket',
    'ja', 'チケットに新しい返信があります'
  );

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    v_ticket.user_id,
    'user',
    'ticket_reply',
    v_title,
    jsonb_build_object('fr', v_ticket.title, 'en', v_ticket.title, 'es', v_ticket.title, 'de', v_ticket.title, 'ja', v_ticket.title),
    '/support/' || v_ticket.id::text,
    jsonb_build_object('ticket_id', v_ticket.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_reply ON public.support_messages;
CREATE TRIGGER trg_notify_ticket_reply
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_reply();

-- ─── Trigger 2 : nouvelle recette publique pending → notif admins ───────────

CREATE OR REPLACE FUNCTION public.notify_recipe_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title jsonb;
BEGIN
  -- Seulement si la recette est marquée pour publication (pending)
  IF NEW.moderation_status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  v_title := jsonb_build_object(
    'fr', 'Nouvelle recette à modérer',
    'en', 'New recipe to moderate',
    'es', 'Nueva receta por moderar',
    'de', 'Neues Rezept zu prüfen',
    'ja', 'モデレーション待ちの新しいレシピ'
  );

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    NULL,                  -- broadcast admins
    'admin',
    'recipe_pending',
    v_title,
    jsonb_build_object('fr', NEW.title, 'en', NEW.title, 'es', NEW.title, 'de', NEW.title, 'ja', NEW.title),
    '/admin/recipes/' || NEW.id::text,
    jsonb_build_object('recipe_id', NEW.id, 'user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_recipe_submitted ON public.custom_recipes;
CREATE TRIGGER trg_notify_recipe_submitted
AFTER INSERT ON public.custom_recipes
FOR EACH ROW
EXECUTE FUNCTION public.notify_recipe_submitted();

-- ─── Trigger 3 : changement de statut recette → notif au propriétaire ──────

CREATE OR REPLACE FUNCTION public.notify_recipe_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title  jsonb;
  v_type   text;
BEGIN
  -- Seulement si le statut a changé
  IF NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
    RETURN NEW;
  END IF;

  IF NEW.moderation_status = 'approved' THEN
    v_type := 'recipe_approved';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été approuvée 🎉',
      'en', 'Your recipe has been approved 🎉',
      'es', '¡Tu receta ha sido aprobada 🎉!',
      'de', 'Dein Rezept wurde genehmigt 🎉',
      'ja', 'レシピが承認されました 🎉'
    );
  ELSIF NEW.moderation_status = 'rejected' THEN
    v_type := 'recipe_rejected';
    v_title := jsonb_build_object(
      'fr', 'Ta recette a été refusée',
      'en', 'Your recipe was declined',
      'es', 'Tu receta fue rechazada',
      'de', 'Dein Rezept wurde abgelehnt',
      'ja', 'レシピが却下されました'
    );
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (recipient_id, recipient_role, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'user',
    v_type,
    v_title,
    jsonb_build_object('fr', NEW.title, 'en', NEW.title, 'es', NEW.title, 'de', NEW.title, 'ja', NEW.title),
    '/recipes/' || NEW.id::text,
    jsonb_build_object('recipe_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_recipe_status_changed ON public.custom_recipes;
CREATE TRIGGER trg_notify_recipe_status_changed
AFTER UPDATE ON public.custom_recipes
FOR EACH ROW
EXECUTE FUNCTION public.notify_recipe_status_changed();

-- ─── Realtime ───────────────────────────────────────────────────────────────
-- Activer Supabase Realtime pour la table notifications. À faire ensuite
-- dans le Dashboard Supabase → Database → Replication → activer pour
-- public.notifications. Le client subscribe via supabase.channel(...).
