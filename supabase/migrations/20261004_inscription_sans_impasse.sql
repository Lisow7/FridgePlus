-- 2026-10-04 — Une inscription ne peut plus échouer pour une question de pseudo,
-- l'acceptation des conditions est enfin datée, et « pseudo déjà pris » dit vrai.
-- Audit du 2026-10-04 : CPT-05, CPT-06, CPT-09.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES TROIS DÉFAUTS
--
-- 1. `handle_new_user` (déclencheur à la création d'un compte) prenait comme
--    pseudo le début de l'adresse e-mail quand aucun n'était fourni — le cas
--    de toute première connexion Google. La contrainte `username_length`
--    impose 3 à 20 caractères et seule la collision était rattrapée : une
--    adresse « jean-baptiste.dupont1985@… » (24 caractères) ou « jo@… » (2)
--    faisait échouer la création du compte. Le repli sur collision ajoutait
--    5 caractères sans vérifier la longueur, et gardait le pseudo « confirmé ».
--    Et un bout d'adresse e-mail n'a rien à faire dans un pseudo public.
--
-- 2. `consent_terms_accepted_at` / `consent_privacy_accepted_at` (preuve datée,
--    RGPD art. 7) n'étaient écrites par PERSONNE : le déclencheur ne les
--    connaissait pas, et le garde interdit au navigateur d'y toucher.
--    Comptées le 2026-10-04 : vides pour 8 comptes sur 8.
--
-- 3. Le contrôle « ce pseudo est-il libre ? » lisait `profiles`, où un visiteur
--    ne voit aucune ligne (politique de lecture : soi ou admin). Il répondait
--    donc toujours « libre ».
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- 1. `handle_new_user` : le pseudo saisi à l'inscription est gardé s'il
--    respecte la règle (3 à 20 lettres, chiffres, `_` ou `-`) et n'est pas
--    réservé. Sinon — compte Google, pseudo pris entre-temps, forme refusée —
--    le compte reçoit un pseudo d'attente `chef_` + 8 caractères et
--    `username_confirmed = false` : l'écran « Choisis ton pseudo » le demande
--    avant toute autre chose. Plus jamais le début de l'adresse e-mail.
--    Si l'inscription transmet `consent_accepted = true` (formulaire e-mail),
--    les deux dates de preuve sont posées à `now()`.
--
-- 2. `record_signup_consent()` : pour le parcours Google, appelée par l'écran
--    de choix du pseudo (qui porte la même case). Pose les deux dates si elles
--    sont vides, à l'heure du serveur.
--    Le garde `guard_profiles_privileged_columns` laisse passer cette écriture
--    et seulement elle : une date de preuve peut passer de vide à « maintenant »
--    (à une minute près), jamais être modifiée, antidatée ni effacée.
--
-- 3. `username_available(text)` : répond vrai ou faux sans exposer `profiles`.
--    Comparaison exacte et insensible à la casse, comme l'index d'unicité
--    (l'ancien `ilike` traitait `_` comme un joker).
--    Elle répond aussi « non » pour un pseudo hors règle ou réservé
--    (`private.pseudo_reserve` : admin…, modérat…, support, staff, la marque).
--
-- CE QU'ELLE NE FAIT PAS
-- - Elle ne fait pas encore REFUSER par la base un pseudo hors règle ou réservé
--   écrit directement dans `profiles` : c'est la migration suivante
--   (`20261005_regle_du_pseudo_tenue_par_la_base.sql`), à appliquer quand
--   l'application qui sait expliquer ce refus est en production.
-- - Elle ne date pas l'acceptation des 8 comptes déjà créés : on ne fabrique
--   pas une preuve après coup.
-- - La liste des pseudos réservés arrête l'usurpation évidente (« Admin »,
--   « FridgePlus_Support »), pas les déguisements (« Adm1n ») : c'est le badge
--   de rôle affiché dans la communauté qui fait foi.
--
-- PREUVE : `supabase/probes/20261004_inscription_sans_impasse.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION private.pseudo_reserve(p_username text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  -- Comparé sans casse, sans chiffres ni séparateurs : « Admin_42 » = « admin ».
  SELECT n ~ '^admin'
      OR n ~ '^moderat'
      OR n ~ 'fridgeplus'
      OR n IN ('modo', 'support', 'staff', 'equipe', 'team', 'officiel', 'official',
               'system', 'systeme', 'root', 'fridge')
      OR n ~ '^(officiel|official|team|equipe|support|staff|modo)fridge'
      OR n ~ 'fridge(officiel|official|team|equipe|support|staff|modo)$'
  FROM (SELECT regexp_replace(lower(coalesce(p_username, '')), '[^a-z]', '', 'g') AS n) AS t;
$function$;

REVOKE ALL ON FUNCTION private.pseudo_reserve(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_saisi     text := nullif(btrim(coalesce(new.raw_user_meta_data->>'username', '')), '');
  v_attente   text := 'chef_' || substr(md5(new.id::text), 1, 8);
  v_pseudo    text;
  v_confirmed boolean;
  -- Case cochée dans le formulaire d'inscription par e-mail : datée ici, à
  -- l'heure du serveur. Sans elle (Google), l'écran de choix du pseudo la
  -- demande et appelle `record_signup_consent()`.
  v_accepte   timestamptz := CASE WHEN new.raw_user_meta_data->>'consent_accepted' = 'true' THEN now() END;
BEGIN
  IF v_saisi ~ '^[A-Za-z0-9_-]{3,20}$' AND NOT private.pseudo_reserve(v_saisi) THEN
    v_pseudo := v_saisi;
    v_confirmed := true;
  ELSE
    -- Pas de pseudo saisi (Google), ou un pseudo que la règle refuse : pseudo
    -- d'attente, que l'écran « Choisis ton pseudo » remplacera.
    v_pseudo := v_attente;
    v_confirmed := false;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, username, avatar_id, username_confirmed, consent_terms_accepted_at, consent_privacy_accepted_at)
    VALUES (new.id, v_pseudo, 'tomato', v_confirmed, v_accepte, v_accepte)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Pseudo pris entre le contrôle de l'écran et la création du compte.
    INSERT INTO public.profiles (id, username, avatar_id, username_confirmed, consent_terms_accepted_at, consent_privacy_accepted_at)
    VALUES (new.id, v_attente, 'tomato', false, v_accepte, v_accepte)
    ON CONFLICT (id) DO NOTHING;
  END;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Dernier filet : la création d'un compte ne doit pas échouer pour une
  -- question de pseudo. Si cette insertion échoue elle aussi, c'est la table
  -- qui a changé : l'erreur remonte, et c'est voulu.
  INSERT INTO public.profiles (id, username, avatar_id, username_confirmed, consent_terms_accepted_at, consent_privacy_accepted_at)
  VALUES (new.id, 'chef_' || substr(md5(new.id::text || clock_timestamp()::text), 1, 12), 'tomato', false, v_accepte, v_accepte)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_signup_consent()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_date timestamptz;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles
     SET consent_terms_accepted_at   = COALESCE(consent_terms_accepted_at, now()),
         consent_privacy_accepted_at = COALESCE(consent_privacy_accepted_at, now())
   WHERE id = (SELECT auth.uid())
  RETURNING consent_terms_accepted_at INTO v_date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_date;
END;
$function$;

COMMENT ON FUNCTION public.record_signup_consent() IS
  'Date l''acceptation des conditions (CGU, âge, confidentialité) du compte courant, une seule fois (audit 2026-10-04, CPT-06).';
REVOKE ALL ON FUNCTION public.record_signup_consent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_consent() TO authenticated;

CREATE OR REPLACE FUNCTION public.username_available(p_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_username IS NOT NULL
     AND (public.is_admin()
          OR (btrim(p_username) ~ '^[A-Za-z0-9_-]{3,20}$' AND NOT private.pseudo_reserve(btrim(p_username))))
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
        WHERE lower(username) = lower(btrim(p_username))
          AND id IS DISTINCT FROM (SELECT auth.uid())
     );
$function$;

COMMENT ON FUNCTION public.username_available(text) IS
  'Vrai si ce pseudo peut être pris par l''appelant : forme valide, non réservé, porté par aucun AUTRE compte (insensible à la casse). N''expose pas la table profiles (audit 2026-10-04, CPT-09).';
REVOKE ALL ON FUNCTION public.username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;

-- Le garde des colonnes privilégiées, à l'identique, sauf les deux dates de
-- preuve : elles peuvent passer de vide à « maintenant », et rien d'autre.
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin, ou ecriture serveur (service_role : pas d'auth.uid()) -> laisser passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role                  IS DISTINCT FROM 'user'
       OR COALESCE(NEW.banned, false)              IS DISTINCT FROM false
       OR NEW.special_role        IS NOT NULL
       OR COALESCE(NEW.subscription_status, 'free') IS DISTINCT FROM 'free'
       OR NEW.subscription_plan   IS NOT NULL
       OR NEW.subscription_ends_at IS NOT NULL
       OR NEW.trial_ends_at       IS NOT NULL
       OR NEW.stripe_customer_id  IS NOT NULL
       OR NEW.community_muted_until IS NOT NULL
       OR NEW.inactive_warned_at  IS NOT NULL
       OR NEW.restore_token       IS NOT NULL
       OR NEW.deleted_at          IS NOT NULL
       -- Une date de preuve ne s'invente pas : vide, ou « maintenant » (2026-10-04).
       OR NEW.consent_terms_accepted_at   NOT BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
       OR NEW.consent_privacy_accepted_at NOT BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    THEN
      RAISE EXCEPTION 'forbidden: cannot set privileged profile columns'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- /!\ `restore_token` et `deleted_at` sont ABSENTS ici, et ce n'est PAS un
  -- oubli : l'auto-restore cote client les ecrit legitimement.
  IF NEW.role                  IS DISTINCT FROM OLD.role
     OR NEW.banned             IS DISTINCT FROM OLD.banned
     OR NEW.special_role       IS DISTINCT FROM OLD.special_role
     OR NEW.subscription_status   IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_plan     IS DISTINCT FROM OLD.subscription_plan
     OR NEW.subscription_ends_at  IS DISTINCT FROM OLD.subscription_ends_at
     OR NEW.trial_ends_at         IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.stripe_customer_id    IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.community_muted_until IS DISTINCT FROM OLD.community_muted_until
     OR NEW.inactive_warned_at    IS DISTINCT FROM OLD.inactive_warned_at
     -- Une date de preuve se pose UNE fois, à l'heure du serveur (à une minute
     -- près) : ni modifiée, ni antidatée, ni effacée (2026-10-04).
     OR (NEW.consent_terms_accepted_at IS DISTINCT FROM OLD.consent_terms_accepted_at
         AND NOT COALESCE(OLD.consent_terms_accepted_at IS NULL
                          AND NEW.consent_terms_accepted_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute', false))
     OR (NEW.consent_privacy_accepted_at IS DISTINCT FROM OLD.consent_privacy_accepted_at
         AND NOT COALESCE(OLD.consent_privacy_accepted_at IS NULL
                          AND NEW.consent_privacy_accepted_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute', false))
  THEN
    RAISE EXCEPTION 'forbidden: cannot modify privileged profile columns'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
