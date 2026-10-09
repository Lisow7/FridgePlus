-- 2026-10-05 — Les champs « d'autorité » ne viennent plus du navigateur.
-- Audit du 2026-10-04 : BDD-14 (le faux « message du support » est déjà fermé
-- par 20261005_reponse_du_support_en_une_ecriture.sql).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LES DÉFAUTS
--
-- 1. Compteurs de la communauté. L'auteur d'un message pouvait réécrire
--    `likes_count` et `replies_count` de son message (et `likes_count` de sa
--    réponse) : la règle de modification ne restreint aucune colonne. Les
--    compteurs se recomptent depuis le lot 3b, mais seulement au prochain
--    « j'aime » ou à la prochaine réponse : un message gonflé à 999 restait
--    en tête du tri « populaires ».
--
-- 2. Tickets. Le propriétaire changeait `status`, `type`, `target_*`,
--    `reason_key` — et pouvait ÉTEINDRE le badge de l'admin
--    (`has_unread_admin`). À la création, il choisissait aussi le statut et
--    « lu par l'admin » : un ticket pouvait naître « résolu ».
--
-- 3. Charte de la communauté. `community_terms_accepted_at` est présentée
--    comme une preuve, mais sa date venait de l'horloge du navigateur et se
--    réécrivait à volonté (antidatée, déplacée).
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- Trois déclencheurs, dans `private` (non exposés), qui ne visent que les
-- écritures DIRECTES d'un compte ordinaire (`pg_trigger_depth() = 1`, un
-- `auth.uid()`, pas admin). Les écritures des autres déclencheurs passent :
-- le recomptage des compteurs (lot 3b, propriétaire postgres) et « non lu
-- par l'admin » posé à chaque message d'un utilisateur (lot 7e, aux droits
-- de l'utilisateur) se font à la profondeur 2.
--
--   garder_les_compteurs   un compte ne change pas un compteur : refus 42501.
--   garder_le_ticket       à la création : ouvert, non lu par l'admin, lu par
--                          son auteur — imposés (comme `ouvrir_ticket`) ;
--                          ensuite son auteur ne change que le titre et « lu »
--                          de son côté ; il peut ALLUMER le badge de l'admin,
--                          pas l'éteindre : refus 42501 sinon.
--   horodater_la_charte    la date se pose à l'heure du serveur ; une date
--                          déjà posée ne se réécrit pas (l'ancienne reste) ;
--                          la RETIRER (NULL) reste permis.
--
-- ══════════════════════════════════════════════════════════════════════════
-- COMPATIBILITÉ (la base est partagée avec la production, v0.145)
--
-- - Production et dev n'écrivent jamais un compteur en base (vérifié dans
--   `origin/main` et `dev`) : ils ne bougent qu'à l'écran.
-- - Tickets, production : création directe `status: 'open'`,
--   `has_unread_user: false`, SANS `has_unread_admin` (défaut false) — la
--   garde l'impose à true au lieu de refuser ; après un message, mise à jour
--   `has_unread_admin: true` (déjà vrai : rien ne change) ; « lu »
--   (`has_unread_user: false`) et le titre : permis. Dev : `ouvrir_ticket`.
-- - Charte : production et dev envoient l'heure du navigateur (remplacée par
--   celle du serveur) et `null` pour la retirer (permis).
-- - `guard_profiles_privileged_columns` n'est pas modifiée.
--
-- PREUVE : `supabase/probes/20261005_champs_d_autorite.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Compteurs de la communauté ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.garder_les_compteurs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF pg_trigger_depth() = 1 AND (SELECT auth.uid()) IS NOT NULL AND NOT public.is_admin() THEN
    -- to_jsonb : la même fonction sert aux messages (deux compteurs) et aux
    -- réponses (un seul).
    IF (to_jsonb(NEW) -> 'likes_count') IS DISTINCT FROM (to_jsonb(OLD) -> 'likes_count')
       OR (to_jsonb(NEW) -> 'replies_count') IS DISTINCT FROM (to_jsonb(OLD) -> 'replies_count') THEN
      RAISE EXCEPTION 'forbidden: counters are kept by the database'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.garder_les_compteurs() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_garder_les_compteurs ON public.community_posts;
CREATE TRIGGER trg_garder_les_compteurs
  BEFORE UPDATE OF likes_count, replies_count ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION private.garder_les_compteurs();

DROP TRIGGER IF EXISTS trg_garder_les_compteurs ON public.community_replies;
CREATE TRIGGER trg_garder_les_compteurs
  BEFORE UPDATE OF likes_count ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION private.garder_les_compteurs();

-- ── 2. Tickets ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.garder_le_ticket()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 OR (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Un ticket naît ouvert, non lu par le support, lu par son auteur.
    NEW.status := 'open';
    NEW.has_unread_admin := true;
    NEW.has_unread_user := false;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.target_type IS DISTINCT FROM OLD.target_type
     OR NEW.target_id IS DISTINCT FROM OLD.target_id
     OR NEW.reason_key IS DISTINCT FROM OLD.reason_key
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (NEW.has_unread_admin IS DISTINCT FROM OLD.has_unread_admin AND NEW.has_unread_admin IS NOT TRUE)
  THEN
    RAISE EXCEPTION 'forbidden: only the support changes this ticket field'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.garder_le_ticket() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_garder_le_ticket ON public.support_tickets;
CREATE TRIGGER trg_garder_le_ticket
  BEFORE INSERT OR UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION private.garder_le_ticket();

-- ── 3. Charte de la communauté ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.horodater_la_charte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  -- Écriture serveur, admin, ou profil d'un autre : comme
  -- guard_profiles_privileged_columns, on laisse passer.
  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.id OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.community_terms_accepted_at IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.community_terms_accepted_at IS NOT NULL THEN
      NEW.community_terms_accepted_at := OLD.community_terms_accepted_at;
    ELSE
      NEW.community_terms_accepted_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.horodater_la_charte() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_horodater_la_charte ON public.profiles;
CREATE TRIGGER trg_horodater_la_charte
  BEFORE INSERT OR UPDATE OF community_terms_accepted_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.horodater_la_charte();

COMMIT;
