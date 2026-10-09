-- 2026-10-06 — Les allergènes d'un compte ne s'enregistrent qu'avec un accord
-- explicite, daté par la base.
-- Décision du 2026-10-06, choix d'Antoine (« allergenes = case ») : « le
-- RGPD demande un accord explicite pour une donnée de santé » (art. 9.2.a).
-- Audit du 2026-10-04 : RGPD (allergènes enregistrés sans base légale dite).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- - `profiles.allergen_consent_at` : la date de l'accord (NULL = pas d'accord).
-- - Déclencheur `trg_garder_l_accord_allergenes` : pour un compte qui écrit son
--   propre profil, la date se pose « maintenant » (à une minute près), ou se
--   retire (NULL) — jamais antidatée ni changée. Une date de preuve ne
--   s'invente pas ; un accord, lui, se retire (art. 7.3). Admin et serveur
--   passent, comme pour `guard_profiles_privileged_columns`, qui n'est pas
--   touché.
-- - `accepter_l_enregistrement_des_allergenes()` : pose la date (une fois) et
--   la rend. `retirer_l_accord_allergenes()` : efface les allergènes ET la
--   date, d'un seul geste. Toutes deux en SECURITY INVOKER : la RLS du profil,
--   le garde et le déclencheur s'appliquent.
--
-- Ce qui ne change pas : un invité garde ses allergènes sur son appareil
-- (`localStorage`), sans envoi ; ils ne montent pas au compte à la connexion.
--
-- ⚠️ LA CONTRAINTE « aucun allergène sans accord » N'EST PAS ICI : la version
-- en production (sans la case) écrit encore les allergènes sans accord, et la
-- refuser casserait ce réglage jusqu'à la release. Elle est dans
-- 20261006_allergenes_contrainte_apres_release.sql, à appliquer JUSTE APRÈS la
-- mise en production. Cette migration-ci est sans effet sur la production : le
-- déclencheur ne se réveille que sur `allergen_consent_at`, que l'ancienne
-- version n'écrit jamais.
--
-- Retour arrière : DROP TRIGGER trg_garder_l_accord_allergenes ON
-- public.profiles; DROP FUNCTION des deux fonctions et de
-- private.garder_l_accord_allergenes(); la colonne peut rester.
--
-- Sonde : supabase/probes/20261006_allergenes_avec_accord.sql.

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allergen_consent_at timestamptz;

CREATE OR REPLACE FUNCTION private.garder_l_accord_allergenes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Admin, ou écriture serveur (pas d'auth.uid()) : laisser passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.allergen_consent_at IS NOT NULL
       AND NEW.allergen_consent_at NOT BETWEEN now() - interval '1 minute' AND now() + interval '1 minute' THEN
      RAISE EXCEPTION 'forbidden: allergen consent date' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.allergen_consent_at IS DISTINCT FROM OLD.allergen_consent_at
     AND NEW.allergen_consent_at IS NOT NULL
     AND NOT (OLD.allergen_consent_at IS NULL
              AND NEW.allergen_consent_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute') THEN
    RAISE EXCEPTION 'forbidden: allergen consent date' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.garder_l_accord_allergenes() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_garder_l_accord_allergenes
  BEFORE INSERT OR UPDATE OF allergen_consent_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.garder_l_accord_allergenes();

CREATE OR REPLACE FUNCTION public.accepter_l_enregistrement_des_allergenes()
RETURNS timestamptz
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_date timestamptz;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles
     SET allergen_consent_at = COALESCE(allergen_consent_at, now())
   WHERE id = (SELECT auth.uid())
  RETURNING allergen_consent_at INTO v_date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.retirer_l_accord_allergenes()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.profiles
     SET allergen_prefs = '{}', allergen_consent_at = NULL
   WHERE id = (SELECT auth.uid());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'no_data_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.accepter_l_enregistrement_des_allergenes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retirer_l_accord_allergenes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepter_l_enregistrement_des_allergenes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirer_l_accord_allergenes() TO authenticated;

COMMIT;
