-- 2026-10-05 — Un plafond quotidien d'e-mails par compte, tenu en base.
-- Audit du 2026-10-04 : BDD-08 (la partie « e-mails » ; le plafond de scans par
-- compte se lit dans `ai_usage_log`, sans migration).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- Les fonctions edge qui envoient un e-mail au titulaire d'un compte
-- (`send-profile-change-notification`, `delete-account`) n'avaient qu'un
-- limiteur EN MÉMOIRE d'instance (`_shared/rate-limit.ts`) : il repart de zéro
-- à chaque démarrage à froid et ne voit pas les autres instances. Un seul
-- compte pouvait donc vider le quota d'envoi partagé de Resend — et avec lui
-- tous les e-mails de l'app (lien de restauration, réponses du support,
-- relances d'inactivité).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- - `public.email_log` : une ligne par e-mail réservé (compte, sorte, heure).
--   RLS active, AUCUNE règle : seuls la clé service et le propriétaire y
--   accèdent ; droits retirés à `anon` et `authenticated`. Effacée avec le
--   compte (ON DELETE CASCADE).
-- - `public.reserver_un_email(compte, sorte, plafond)` : sous un verrou propre
--   au compte (deux envois simultanés ne lisent pas le même compte), compte
--   les envois des dernières 24 heures ; sous le plafond, écrit la ligne et
--   rend vrai, sinon faux. Aux droits de l'appelant (pas de SECURITY DEFINER),
--   exécutable par la seule clé service.
-- - Purge quotidienne des lignes de plus de 7 jours (`purge_email_log`) : le
--   plafond ne regarde que 24 heures (minimisation).
--
-- Les fonctions edge qui l'appellent (`_shared/email-quota.ts`) ne sont PAS
-- déployées par cette migration : leur déploiement attend l'accord d'Antoine.
-- Jusque-là, la table reste vide et ne change rien.
--
-- PREUVE : `supabase/probes/20261005_quotas_par_compte.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.email_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CONSTRAINT email_log_kind_format CHECK (kind ~ '^[a-z][a-z0-9_]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_log_user_created_idx ON public.email_log (user_id, created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_log FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserver_un_email(p_user_id uuid, p_kind text, p_max_par_jour integer DEFAULT 10)
RETURNS boolean
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_max_par_jour IS NULL OR p_max_par_jour < 1 THEN
    RETURN false;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('reserver_un_email:' || p_user_id::text, 0));
  IF (SELECT count(*) FROM public.email_log
       WHERE user_id = p_user_id AND created_at > now() - interval '1 day') >= p_max_par_jour THEN
    RETURN false;
  END IF;
  INSERT INTO public.email_log (user_id, kind) VALUES (p_user_id, p_kind);
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserver_un_email(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserver_un_email(uuid, text, integer) TO service_role;

SELECT cron.schedule('purge_email_log', '20 4 * * *', $$DELETE FROM public.email_log WHERE created_at < now() - interval '7 days'$$);

COMMIT;
