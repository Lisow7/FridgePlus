-- 2026-10-05 — La réponse du support tient en une écriture, et personne
-- d'autre que l'admin ne peut répondre au nom du support. Audit du
-- 2026-10-04 : ADM-02 (lot 7b) ; plus un constat hors audit du 2026-10-05.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS
--
-- 1. (ADM-02) Répondre à un ticket, c'était DEUX écritures du navigateur : le
--    message, puis la mise à jour du ticket (« non lu par l'utilisateur »,
--    « en cours »), dont le résultat était jeté. Si la seconde échouait, le
--    message partait mais l'utilisateur n'avait pas de pastille et le ticket
--    restait « ouvert ».
-- 2. (hors audit, lu le 2026-10-05) La règle d'insertion de `support_messages`
--    est « admin, ou le propriétaire du ticket » — sans exiger, pour un
--    non-admin, `is_admin = false` ni `sender_id = soi`. Un compte pouvait donc
--    écrire dans SON ticket un message affiché comme une réponse du support ;
--    `notify_ticket_reply` lui envoyait même « Nouvelle réponse à ton ticket ».
--    De quoi fabriquer une fausse capture « réponse du support ».
--
-- CE QUE FAIT CETTE MIGRATION
--
-- • `marquer_ticket_repondu()` + déclencheur `trg_ticket_repondu` (AFTER INSERT,
--   message de l'admin seulement) : le ticket passe « non lu par
--   l'utilisateur », « lu par l'admin », « en cours » DANS la même transaction
--   que le message. SECURITY INVOKER : seul l'admin peut écrire un message de
--   l'admin (point suivant), et il a déjà le droit de modifier tout ticket.
-- • `support_messages_insert` : pour un non-admin, `is_admin` faux ET
--   `sender_id = auth.uid()` en plus de « son propre ticket ».
--   `ouvrir_ticket` et `sendUserMessage` écrivent déjà exactement cela.
--
-- PREUVE : `supabase/probes/20261005_reponse_du_support.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.marquer_ticket_repondu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.support_tickets
     SET has_unread_user = true, has_unread_admin = false, status = 'in_progress'
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.marquer_ticket_repondu() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ticket_repondu ON public.support_messages;
CREATE TRIGGER trg_ticket_repondu
  AFTER INSERT ON public.support_messages
  FOR EACH ROW WHEN (NEW.is_admin IS TRUE)
  EXECUTE FUNCTION public.marquer_ticket_repondu();

DROP POLICY IF EXISTS support_messages_insert ON public.support_messages;
CREATE POLICY support_messages_insert ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (
      is_admin IS NOT TRUE
      AND sender_id = (SELECT auth.uid())
      AND EXISTS (SELECT 1 FROM public.support_tickets t
                   WHERE t.id = support_messages.ticket_id AND t.user_id = (SELECT auth.uid()))
    )
  );

COMMIT;
