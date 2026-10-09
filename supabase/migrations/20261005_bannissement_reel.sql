-- 2026-10-05 — Un bannissement qui coupe vraiment : motif, durée, session.
-- Audit du 2026-10-04 : CPT-17 (bannir aussi dans le service d'authentification,
-- motif et durée) et le complément de BDD-02 (« couper la connexion demande de
-- poser banned_until côté Auth »).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- « Bannir » n'écrivait que `profiles.banned`. Depuis le lot 3a la base refuse
-- les écritures d'un compte banni, mais sa session restait valide : il pouvait
-- se reconnecter, et appeler les fonctions edge (scan, IA) qui ne regardent
-- que la validité du jeton. Aucun motif, aucune durée : on ne pouvait que
-- bannir pour toujours, sans dire pourquoi.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- - `profiles.banned_reason` (300 caractères au plus) et `profiles.banned_until`
--   (NULL = sans date de fin) ; le compte lui-même ne peut pas les écrire
--   (`trg_garder_le_bannissement`).
-- - `public.admin_bannir(compte, motif, jours)` — admin seulement, ni soi-même
--   ni un admin, motif obligatoire (refusé au-delà de 300 caractères, jamais
--   tronqué), 1 à 3 650 jours ou NULL (sans fin). Elle pose le bannissement,
--   l'inscrit dans le service d'authentification (`auth.users.banned_until` :
--   la date de fin, ou dans 100 ans — la valeur que Supabase documente pour
--   « sans fin », 'infinity' n'étant pas lisible par le service), coupe les
--   sessions ouvertes (les jetons de renouvellement et les traces MFA suivent
--   en cascade) et écrit au journal (motif, fin, durée).
--   Le jeton déjà délivré reste valable jusqu'à son expiration (au plus une
--   heure) ; la base refuse déjà toute écriture pendant ce temps.
-- - `public.admin_debannir(compte)` — défait tout, et l'écrit au journal.
-- - Un bannissement daté prend fin à sa date : `compte_peut_ecrire()` et
--   `ouvrir_ticket` regardent `banned_until` ; une tâche planifiée
--   (`lever_les_bannissements_echus`, tous les quarts d'heure) remet ensuite
--   le drapeau à faux et l'écrit au journal.
--
-- Le bannissement passe par une fonction de la base, et non par une fonction
-- edge comme l'audit le proposait : la base peut écrire `auth.users` et
-- `auth.sessions`, sans rien déployer hors de la release.
--
-- CE QU'ELLE NE FAIT PAS : la fenêtre admin (motif, durée) et l'écran du compte
-- banni (motif, date, « Se déconnecter ») attendent l'avis d'Antoine sur
-- maquette ; jusque-là, le bouton « Bannir » du panneau écrit encore
-- `profiles.banned` seul (bannissement sans fin, sans ban Auth). Aucun essai ne
-- peut prouver ici que le service d'authentification refuse la connexion après
-- cette écriture directe : à vérifier après la release avec un compte d'essai.
--
-- PREUVE : `supabase/probes/20261005_bannissement_reel.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Motif et fin ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_reason text
    CONSTRAINT profiles_banned_reason_longueur CHECK (char_length(banned_reason) <= 300),
  ADD COLUMN IF NOT EXISTS banned_until timestamptz;

CREATE OR REPLACE FUNCTION private.garder_le_bannissement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Écriture serveur, admin, ou profil d'un autre : on laisse passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.banned_reason IS NOT NULL OR NEW.banned_until IS NOT NULL THEN
      RAISE EXCEPTION 'forbidden: cannot set ban columns' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF NEW.banned_reason IS DISTINCT FROM OLD.banned_reason OR NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
    RAISE EXCEPTION 'forbidden: cannot modify ban columns' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.garder_le_bannissement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_garder_le_bannissement ON public.profiles;
CREATE TRIGGER trg_garder_le_bannissement
  BEFORE INSERT OR UPDATE OF banned_reason, banned_until ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.garder_le_bannissement();

-- ── Un bannissement daté prend fin à sa date ────────────────────────────────
CREATE OR REPLACE FUNCTION private.compte_peut_ecrire()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (SELECT auth.uid())
       AND ((COALESCE(banned, false) AND (banned_until IS NULL OR banned_until > now()))
            OR deleted_at IS NOT NULL)
  );
$function$;

CREATE OR REPLACE FUNCTION public.ouvrir_ticket(p_type text, p_title text, p_message text DEFAULT NULL::text, p_target_type text DEFAULT NULL::text, p_target_id text DEFAULT NULL::text, p_reason_key text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
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
  -- la bonne chose. Le compte lit sa propre ligne de profil. Un bannissement
  -- daté et échu ne compte plus (2026-10-05).
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = v_uid
       AND ((coalesce(banned, false) AND (banned_until IS NULL OR banned_until > now()))
            OR deleted_at IS NOT NULL)
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

-- ── Bannir, débannir ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bannir(p_user_id uuid, p_motif text, p_jours integer DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_admin uuid := auth.uid();
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
  v_fin   timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_user_id IS NULL OR p_user_id = v_admin THEN
    RAISE EXCEPTION 'cannot_ban_self' USING ERRCODE = '22023';
  END IF;
  IF v_motif IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_motif) > 300 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;
  IF p_jours IS NOT NULL AND (p_jours < 1 OR p_jours > 3650) THEN
    RAISE EXCEPTION 'invalid_duration' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'cannot_ban_admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_fin := CASE WHEN p_jours IS NULL THEN NULL ELSE now() + make_interval(days => p_jours) END;

  UPDATE public.profiles
     SET banned = true, banned_reason = v_motif, banned_until = v_fin
   WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Le service d'authentification refuse alors la connexion et le
  -- renouvellement ; les sessions ouvertes sont coupées.
  UPDATE auth.users SET banned_until = coalesce(v_fin, now() + interval '100 years') WHERE id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;

  INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
  VALUES (v_admin, 'user_banned', p_user_id::text, 'user',
          jsonb_build_object('reason', v_motif, 'until_iso', v_fin, 'duration_days', p_jours));

  RETURN v_fin;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_bannir(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bannir(uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_debannir(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles
     SET banned = false, banned_reason = NULL, banned_until = NULL
   WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  INSERT INTO public.activity_logs (user_id, action, target_id, target_type)
  VALUES (auth.uid(), 'user_unbanned', p_user_id::text, 'user');
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_debannir(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_debannir(uuid) TO authenticated;

-- ── Les bannissements échus sont levés ──────────────────────────────────────
CREATE OR REPLACE FUNCTION private.lever_les_bannissements_echus()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_n integer;
BEGIN
  WITH leves AS (
    UPDATE public.profiles
       SET banned = false, banned_reason = NULL, banned_until = NULL
     WHERE banned AND banned_until IS NOT NULL AND banned_until <= now()
    RETURNING id
  ), journal AS (
    INSERT INTO public.activity_logs (user_id, action, target_id, target_type, metadata)
    SELECT NULL, 'user_unbanned', id::text, 'user', jsonb_build_object('reason', 'expired')
      FROM leves
  )
  SELECT count(*) INTO v_n FROM leves;
  RETURN v_n;
END;
$function$;

REVOKE ALL ON FUNCTION private.lever_les_bannissements_echus() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('lever_les_bannissements_echus', '*/15 * * * *', $$SELECT private.lever_les_bannissements_echus()$$);

COMMIT;
