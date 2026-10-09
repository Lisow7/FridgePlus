-- Reconstitué le 2026-10-08 depuis le registre de la base
-- (supabase_migrations.schema_migrations, version 20260813111101) : appliquée
-- sans fichier homonyme dans le dépôt (audit du 2026-10-04, BDD-19 / ARCH-10).
-- C'est elle qui est en base, et non `20260808_guard_profiles_columns_restantes.sql`
-- (le brouillon d'avant le dry-run). Elle est en base : ne pas la rejouer.
-- ── SQL du registre, recopié tel quel (md5 c49f29e61b686705fa80da9b727d6a81) ──
-- Ajoute consent_terms_accepted_at / consent_privacy_accepted_at au garde de
-- colonnes privilegiees de `profiles` : leur valeur PROBATOIRE suppose que
-- l'utilisateur ne puisse pas les reecrire lui-meme.
--
-- 🔴 `deleted_at` et `restore_token` sont VOLONTAIREMENT ABSENTS de la branche
-- UPDATE. La version du 2026-08-08 les incluait en affirmant qu'ils n'etaient
-- jamais ecrits par le client : c'est FAUX. `auth-provider.jsx:127-140` les
-- ecrit tous les deux sur `profiles`, sur la propre ligne de l'utilisateur —
-- c'est l'auto-restore d'un compte soft-deleted a la reconnexion dans les
-- 30 jours. Prouve par dry-run : AUTO-RESTORE = BLOQUE (42501), et l'echec
-- aurait ete SILENCIEUX (erreur journalisee sous import.meta.env.DEV seulement)
-- => compte reste programme pour purge. Voir
-- supabase/migrations/20260808_guard_profiles_columns_restantes.sql.
--
-- La branche INSERT les conserve : un INSERT n'est pas un UPDATE, et aucun
-- `.from('profiles').insert(` n'existe cote client.

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
     OR NEW.consent_terms_accepted_at   IS DISTINCT FROM OLD.consent_terms_accepted_at
     OR NEW.consent_privacy_accepted_at IS DISTINCT FROM OLD.consent_privacy_accepted_at
  THEN
    RAISE EXCEPTION 'forbidden: cannot modify privileged profile columns'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;
