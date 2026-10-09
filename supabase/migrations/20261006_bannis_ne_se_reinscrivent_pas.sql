-- 2026-10-06 — Une personne bannie qui supprime son compte ne se réinscrit pas
-- avec la même adresse.
-- Note d'Antoine sur la planche d'arbitrages (2026-10-05, choix `ban_ecrans`) :
-- « faire en sorte que si la personne est bannie et qu'elle supprime son
-- compte, elle ne puisse pas refaire un nouveau compte avec le compte qui a
-- été banni ».
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE TROU
--
-- Pendant les 30 jours d'une suppression, l'adresse reste dans `auth.users` :
-- une nouvelle inscription avec elle est déjà refusée (« déjà inscrite »). Le
-- trou s'ouvrait à l'EFFACEMENT (purge à 30 jours, ou tableau de bord) : le
-- compte disparu, l'adresse redevenait libre, et le bannissement avec elle.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- - `private.adresses_interdites` : l'EMPREINTE (sha256 de l'adresse en
--   minuscules) — jamais l'adresse elle-même — et la date jusqu'à laquelle elle
--   reste interdite (NULL = sans fin). Aucun rôle de l'API n'y accède.
-- - À l'effacement d'un compte encore banni (`BEFORE DELETE` sur `auth.users`,
--   quelle que soit la voie), son empreinte y est gardée jusqu'à la fin du
--   bannissement. Un bannissement échu ne laisse rien.
-- - À la création d'un compte, ou au changement d'adresse (`BEFORE INSERT OR
--   UPDATE OF email`), une adresse interdite est refusée. Supabase rend alors
--   « Database error saving new user » : l'inscription échoue.
--
-- ⚠️ Un déclencheur fautif sur `auth.users` bloquerait TOUTES les
-- inscriptions. D'où : fonctions qualifiées par leur schéma (`search_path`
-- vide), aucune lecture hors de `private`, et l'essai à blanc qui rejoue la
-- logique sur une table temporaire, sans toucher aux comptes réels.
--
-- Ce que ça ne couvre pas, et ne peut pas couvrir : une AUTRE adresse (ou un
-- autre compte Google). L'empreinte d'une adresse n'identifie pas une personne.
--
-- Voies d'effacement vérifiées le 2026-10-06 : la seule du code est
-- `auth.admin.deleteUser` (effacement DUR) dans `purge-soft-deleted-accounts`,
-- profil encore présent ; la tâche `anonymize_soft_deleted_profiles` qui la
-- précède (`public.anonymize_user`) ne touche ni au bannissement ni à
-- l'adresse. ⚠️ La suppression « douce » de GoTrue (`shouldSoftDelete`) passe
-- par un UPDATE, pas un DELETE : elle contournerait ce déclencheur. Ne pas
-- l'introduire sans l'étendre.
--
-- RETOUR ARRIÈRE (si les inscriptions échouent) : remplacer le corps de
-- `private.refuser_une_adresse_interdite()` par `BEGIN RETURN NEW; END;` — il
-- suffit d'en être propriétaire. `DROP TRIGGER … ON auth.users` marche aussi
-- (permis à `postgres`, vérifié à blanc).
--
-- PREUVE : `supabase/probes/20261006_bannis_ne_se_reinscrivent_pas.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Ne jamais faire la queue derrière une longue transaction sur `auth.users` :
-- poser un déclencheur y prend un verrou qui bloquerait les écritures du
-- service d'authentification (inscriptions, connexions).
SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS private.adresses_interdites (
  empreinte text PRIMARY KEY,
  jusqu_au  timestamptz,
  cree_le   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE private.adresses_interdites IS
  'Empreintes (sha256, minuscules) des adresses des comptes effacés pendant un bannissement. jusqu_au NULL = sans fin. Lot 3c-3b, 2026-10-06.';
REVOKE ALL ON private.adresses_interdites FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.empreinte_adresse(p_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT encode(extensions.digest(lower(btrim(coalesce(p_email, ''))), 'sha256'), 'hex');
$function$;
REVOKE ALL ON FUNCTION private.empreinte_adresse(text) FROM PUBLIC, anon, authenticated;

-- La décision, à part du déclencheur : elle s'essaie à blanc avec des valeurs
-- inventées, sans qu'aucun profil réel soit banni pour la prouver.
-- Un bannissement échu ne laisse rien ; « sans fin » l'emporte sur une date,
-- et de deux dates, la plus lointaine.
CREATE OR REPLACE FUNCTION private.retenir_l_empreinte(p_email text, p_banni boolean, p_fin timestamptz)
RETURNS void
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF COALESCE(p_banni, false) AND (p_fin IS NULL OR p_fin > now()) AND p_email IS NOT NULL THEN
    INSERT INTO private.adresses_interdites (empreinte, jusqu_au)
    VALUES (private.empreinte_adresse(p_email), p_fin)
    ON CONFLICT (empreinte) DO UPDATE
      SET jusqu_au = CASE
        WHEN private.adresses_interdites.jusqu_au IS NULL OR EXCLUDED.jusqu_au IS NULL THEN NULL
        ELSE GREATEST(private.adresses_interdites.jusqu_au, EXCLUDED.jusqu_au)
      END;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION private.retenir_l_empreinte(text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;

-- À l'effacement d'un compte : lire son bannissement AVANT que la cascade
-- n'efface le profil (un BEFORE DELETE voit encore la ligne de `profiles`).
CREATE OR REPLACE FUNCTION private.garder_l_adresse_d_un_banni()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_banni boolean;
  v_fin   timestamptz;
BEGIN
  SELECT COALESCE(p.banned, false), p.banned_until
    INTO v_banni, v_fin
    FROM public.profiles p
   WHERE p.id = OLD.id;
  PERFORM private.retenir_l_empreinte(OLD.email, v_banni, v_fin);
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION private.garder_l_adresse_d_un_banni() FROM PUBLIC, anon, authenticated;

-- À la création d'un compte, ou au changement d'adresse : refuser une adresse interdite.
CREATE OR REPLACE FUNCTION private.refuser_une_adresse_interdite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Le service d'authentification réécrit la ligne à chaque connexion : une
  -- adresse inchangée ne se contrôle pas.
  IF TG_OP = 'UPDATE' AND NEW.email IS NOT DISTINCT FROM OLD.email THEN
    RETURN NEW;
  END IF;
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM private.adresses_interdites a
     WHERE a.empreinte = private.empreinte_adresse(NEW.email)
       AND (a.jusqu_au IS NULL OR a.jusqu_au > now())
  ) THEN
    RAISE EXCEPTION 'adresse_interdite' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.refuser_une_adresse_interdite() FROM PUBLIC, anon, authenticated;

-- CREATE OR REPLACE (Postgres ≥ 14) : rejouable sans DROP — posé puis rejoué
-- à blanc le 2026-10-06.
CREATE OR REPLACE TRIGGER garder_l_adresse_d_un_banni
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.garder_l_adresse_d_un_banni();

CREATE OR REPLACE TRIGGER refuser_une_adresse_interdite
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.refuser_une_adresse_interdite();

COMMIT;
