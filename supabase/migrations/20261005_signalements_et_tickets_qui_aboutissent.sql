-- 2026-10-05 — Les signalements et les tickets du support aboutissent.
-- Hors audit du 2026-10-04 (lot 7e), trouvé et prouvé sur la vraie base.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS
--
-- 1. AUCUN signalement d'un post, d'une réponse, d'un profil de la communauté
--    ou d'un avis n'a jamais abouti : les quatre fonctions du navigateur
--    écrivaient une colonne `body` qui n'existe pas et oubliaient `title`,
--    obligatoire (corrigé côté code : elles passent par `createReport`). Pour
--    un avis, la contrainte `chk_support_tickets_target_type` refusait EN PLUS
--    la cible `recipe_review` : la migration `20260510_community_blocks_v3_166_3`
--    l'a réécrite en l'oubliant.
-- 2. Le ticket était créé, PUIS son premier message inséré, sans regarder le
--    résultat : un refus laissait un ticket vide (qui occupe une des 3 places),
--    « bien reçu » à l'écran, le texte de la question ou le détail du
--    signalement perdu.
-- 3. Rien côté serveur ne pose « non lu par l'admin » (`has_unread_admin`) : le
--    navigateur s'en chargeait — sans vérifier — après un message, et pas du
--    tout à l'ouverture d'une question. Une question n'entrait donc pas dans la
--    pastille de l'admin.
--
-- CE QUE FAIT CETTE MIGRATION
--
-- • `chk_support_tickets_target_type` retrouve `recipe_review` (les 7 autres
--   cibles sont inchangées ; la table ne contient aucune ligne qui la gêne).
-- • `public.ouvrir_ticket(...)` crée le ticket ET son premier message D'UN SEUL
--   COUP : si le message est refusé, le ticket n'existe pas. Elle s'exécute avec
--   les droits de l'APPELANT (SECURITY INVOKER) : les règles d'accès des deux
--   tables (plafond de 3 tickets ouverts, comptes bannis, « son propre ticket »)
--   s'appliquent exactement comme avant — aucun droit nouveau. Un compte banni
--   ou supprimé est refusé avec `account_restricted` plutôt qu'avec le refus
--   générique 42501, que le navigateur prend pour le plafond.
-- • Un déclencheur pose `has_unread_admin` à chaque message d'un utilisateur
--   (pas de l'admin). Il s'exécute lui aussi avec les droits de l'appelant :
--   la règle « mettre à jour son propre ticket » le permet déjà.
--
-- Compatible avec l'application en production (v0.145) : elle n'appelle pas la
-- fonction, et le déclencheur répare même ses questions (pastille de l'admin).
--
-- PREUVE : `supabase/probes/20261005_signalements_et_tickets.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS chk_support_tickets_target_type;

ALTER TABLE public.support_tickets ADD CONSTRAINT chk_support_tickets_target_type
  CHECK (target_type IS NULL OR target_type IN (
    'recipe', 'user', 'comment', 'ingredient',
    'community_post', 'community_reply', 'community_profile', 'recipe_review'
  ));

CREATE OR REPLACE FUNCTION public.ouvrir_ticket(
  p_type        text,
  p_title       text,
  p_message     text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id   text DEFAULT NULL,
  p_reason_key  text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_uid     uuid := auth.uid();
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_ticket  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Les règles d'accès refuseraient aussi ce compte, mais avec le même code
  -- (42501) que le plafond de tickets : on le dit ici, pour que l'écran dise
  -- la bonne chose. Le compte lit sa propre ligne de profil.
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_uid AND (coalesce(banned, false) OR deleted_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'account_restricted' USING ERRCODE = 'P0001';
  END IF;

  -- Une question ou une demande sans texte n'a pas de contenu : refusée. Un
  -- signalement peut n'avoir que son motif.
  IF p_type IS DISTINCT FROM 'report' AND v_message IS NULL THEN
    RAISE EXCEPTION 'message_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.support_tickets
    (user_id, type, title, status, target_type, target_id, reason_key, has_unread_admin, has_unread_user)
  VALUES
    (v_uid, p_type, btrim(coalesce(p_title, '')), 'open', p_target_type, p_target_id, p_reason_key, true, false)
  RETURNING id INTO v_ticket;

  IF v_message IS NOT NULL THEN
    INSERT INTO public.support_messages (ticket_id, sender_id, is_admin, content)
    VALUES (v_ticket, v_uid, false, v_message);
  END IF;

  RETURN v_ticket;
END;
$function$;

REVOKE ALL ON FUNCTION public.ouvrir_ticket(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ouvrir_ticket(text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marquer_ticket_non_lu_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.support_tickets SET has_unread_admin = true WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$function$;

-- Une fonction de déclencheur n'a pas à être appelable par l'API.
REVOKE ALL ON FUNCTION public.marquer_ticket_non_lu_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ticket_non_lu_admin ON public.support_messages;
CREATE TRIGGER trg_ticket_non_lu_admin
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  WHEN (NEW.is_admin IS NOT TRUE)
  EXECUTE FUNCTION public.marquer_ticket_non_lu_admin();

COMMIT;
