-- 2026-10-05 — La règle du pseudo est tenue par la base, plus seulement par
-- le navigateur. Audit du 2026-10-04 : CPT-09 (suite de
-- `20261004_inscription_sans_impasse.sql`).
--
-- ⚠️ À APPLIQUER SEULEMENT QUAND L'APPLICATION QUI SAIT EXPLIQUER CE REFUS EST
-- EN PRODUCTION (la version qui contient `src/shared/lib/auth/username-rules.js`).
-- L'écran « Choisis ton pseudo » d'avant ne contrôlait que la longueur : avec
-- cette migration, « Zoé » ou « Jean Dupont » y seraient refusés par un message
-- générique (« Impossible d'enregistrer »), sans dire pourquoi. C'est la seule
-- raison pour laquelle elle est séparée de la précédente.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- Aucune règle de forme n'était tenue par la base : seul le navigateur refusait
-- « <b>Zoé</b> » ou « Admin ». Un appel direct à l'API les faisait passer
-- (joué le 2026-10-04 : les deux ont été acceptés).
--
-- CE QUE FAIT CETTE MIGRATION
--
-- `guard_profiles_username` : pour un non-admin, un pseudo qui CHANGE doit
-- respecter la règle (3 à 20 lettres, chiffres, `_` ou `-`) et ne pas être
-- réservé (`private.pseudo_reserve`, créée par la migration précédente).
-- Un pseudo ancien hors règle reste en place tant que la personne n'y touche
-- pas (un seul compte concerné le 2026-10-04) ; l'admin et le serveur ne sont pas tenus.
--
-- La règle n'admet que des caractères ASCII : c'est ce qui rend la liste des
-- pseudos réservés utile (un « Аdmin » écrit avec un A cyrillique ne passe pas).
--
-- PREUVE : `supabase/probes/20261004_inscription_sans_impasse.sql` (lignes D4,
-- D5, D6 et F2 ; les autres lignes vérifient que rien d'autre ne bouge).
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profiles_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Admin, ou écriture serveur (pas d'auth.uid()) : laisser passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  -- Un pseudo ancien hors règle reste en place tant qu'on n'y touche pas.
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;
  IF NEW.username IS NULL OR NEW.username !~ '^[A-Za-z0-9_-]{3,20}$' THEN
    RAISE EXCEPTION 'invalid_username: 3 to 20 letters, digits, _ or -'
      USING ERRCODE = 'check_violation';
  END IF;
  IF private.pseudo_reserve(NEW.username) THEN
    RAISE EXCEPTION 'reserved_username: this username is reserved'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

-- Comme les autres fonctions de déclencheur SECURITY DEFINER du schéma : elle
-- n'est appelable que par son déclencheur.
REVOKE ALL ON FUNCTION public.guard_profiles_username() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profiles_username ON public.profiles;
CREATE TRIGGER trg_guard_profiles_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_username();

COMMIT;
