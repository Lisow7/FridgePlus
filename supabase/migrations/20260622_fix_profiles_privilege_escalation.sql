-- ════════════════════════════════════════════════════════════════════════
-- SECURITY FIX (CRITIQUE) — escalade de privileges via profiles
-- ════════════════════════════════════════════════════════════════════════
-- Cause racine : la policy RLS `profiles_update` (USING/WITH CHECK = owner)
-- n'impose AUCUNE restriction de colonne. Un utilisateur connecte pouvait
-- donc faire `UPDATE profiles SET role='admin' WHERE id = auth.uid()` et
-- s'auto-promouvoir admin (puis appeler toutes les RPC admin), se debannir,
-- se demuter, ou s'auto-attribuer le premium. Prouve en live (rollback).
--
-- Fix : trigger BEFORE INSERT OR UPDATE qui bloque un NON-admin modifiant une
-- colonne privilegiee sur SA PROPRE ligne. Discriminateur robuste :
--   (auth.uid() = NEW.id) AND NOT is_admin()
-- Les ecrivains legitimes passent :
--   - admin (client ou RPC SECURITY DEFINER)  : is_admin() = true     -> skip
--   - Stripe webhook / pg_cron (service_role)  : auth.uid() IS NULL    -> skip
--   - admin agissant sur un AUTRE user         : auth.uid() <> NEW.id  -> skip
-- En BEFORE trigger, is_admin() lit l'etat COMMITTE (role pre-UPDATE) : un
-- self-promoteur est encore 'user' au moment du check -> pas de contournement.

CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Ne contraindre QUE un non-admin agissant sur sa propre ligne.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un self-insert non-admin ne peut pas semer de colonne privilegiee.
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
    THEN
      RAISE EXCEPTION 'forbidden: cannot set privileged profile columns'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE : bloquer si une colonne privilegiee change.
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
  THEN
    RAISE EXCEPTION 'forbidden: cannot modify privileged profile columns'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_privileged ON public.profiles;
CREATE TRIGGER trg_guard_profiles_privileged
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_privileged_columns();
