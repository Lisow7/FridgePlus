-- ============================================================================
-- Plafond SERVEUR de tickets ouverts (MAX_OPEN_TICKETS = 3)
-- Date : 2026-08-12
-- Origine : revue transverse du 2026-08-07, finding securite [moyen] n°3.
--
-- LE DEFAUT
-- Le plafond de 3 tickets ouverts n'existait que cote CLIENT, en double :
--   src/features/support/api/support.js:7   (createTicket)
--   src/shared/api/reports.js:39            (createReport)
-- Les deux copies sont identiques (3, statuts 'open'/'in_progress', comparaison
-- `>=`) — verifie le 2026-08-12, pas de derive entre elles. Mais un simple
-- appel PostgREST direct avec un JWT valide contournait les deux : rien en base
-- ne limitait les insertions. Un utilisateur authentifie pouvait noyer la file
-- de moderation. Pas d'elevation de privilege, mais un deni de service sur le
-- travail de moderation — et `support_tickets` recoit AUSSI tous les
-- signalements communaute, donc la file grossit avec l'activite.
--
-- CE QUI N'EST PAS FAIT, ET POURQUOI
-- L'audit demandait aussi une FK sur `target_id`. C'est IMPOSSIBLE en Postgres :
-- `chk_support_tickets_target_type` autorise 7 types de cible (recipe, user,
-- comment, ingredient, community_post, community_reply, community_profile) —
-- `target_id` est polymorphe et ne peut donc pas referencer une table unique.
-- Le remede d'origine est mort ne. Une validation par type demanderait un
-- trigger dedie ; hors sujet de cette migration.
--
-- DEUX IMPASSES MESUREES AVANT D'ARRIVER ICI (dry-run sur la vraie base,
-- transaction annulee par exception — 2026-08-12) :
--
--   1. Sous-requete `count(*) from support_tickets` DIRECTEMENT dans le
--      `WITH CHECK` de la policy  ->  ERREUR 42P17, « infinite recursion
--      detected in policy for relation support_tickets ». Une policy qui
--      interroge sa propre table recurse. Elle bloquait TOUT, y compris l'admin.
--      => d'ou la fonction SECURITY DEFINER ci-dessous : elle contourne la RLS
--         et casse la boucle.
--
--   2. `REVOKE EXECUTE ... FROM authenticated` sur cette fonction (le reflexe
--      « fonction interne ») ->  ERREUR 42501 sur CHAQUE insertion. Les
--      expressions de policy s'evaluent avec les droits de l'APPELANT. Et
--      l'admin tombait aussi : Postgres NE GARANTIT PAS le court-circuit d'un
--      `OR`, donc la branche `is_admin()` n'evite pas l'evaluation de l'autre.
--      => EXECUTE doit etre accorde a `authenticated`. Sans risque : la
--         fonction ne prend AUCUN parametre et ne compte que les tickets de
--         l'appelant — l'appeler directement n'apprend rien qu'il ne puisse
--         deja compter lui-meme.
--
-- 🔴 LIMITE CONNUE : CE PLAFOND NE SERIALISE PAS LES INSERTIONS CONCURRENTES
-- Le controle est un « lire puis inserer ». En READ COMMITTED, deux transactions
-- simultanees evaluent chacune `compte_tickets_ouverts()` sur SON instantane et
-- ne voient pas la ligne encore non validee de l'autre : les deux passent. Un
-- utilisateur a 2 tickets ouverts qui envoie deux requetes en parallele finit a
-- 4 ; qui en envoie 50 d'un coup les fait largement passer.
--
-- Ce que cette migration corrige REELLEMENT : l'abus SEQUENTIEL, c'est-a-dire le
-- contournement trivial du compteur client par des appels PostgREST successifs.
-- C'est un gain reel sur « rien du tout », mais ce n'est PAS une protection
-- anti-inondation.
--
-- ⚠️ Limite RAISONNEE depuis la semantique de Postgres, pas mesuree : le
-- dry-run se joue dans une seule session et ne peut pas produire la course.
--
-- L'inondation concurrente releve du rate-limiting, deja liste comme point
-- OUVERT et distinct du plan de route (note d'audit backend §3, « rate-limit
-- PG »). Fermer la course ici demanderait un `pg_advisory_xact_lock` dans la
-- fonction — ce qui la rend VOLATILE et ouvre ses propres questions de
-- contention : un sujet a part entiere, pas un ajout a cette migration.
--
-- POURQUOI service_role N'EST PAS PLAFONNE
-- La policy ne vise que le role `authenticated`. `service_role` contourne la
-- RLS : les edge functions et l'admin cote serveur ne sont pas bloques. C'est
-- volontaire — meme raisonnement que le garde de colonnes de `profiles`.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

-- Compte les tickets ouverts de l'APPELANT. Sans parametre : impossible de
-- sonder le compteur d'autrui. SECURITY DEFINER pour lire la table sans
-- declencher la RLS (cf. impasse n°1 ci-dessus).
CREATE OR REPLACE FUNCTION private.compte_tickets_ouverts()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT count(*)::int
  FROM public.support_tickets
  WHERE user_id = (SELECT auth.uid())
    AND status IN ('open', 'in_progress');
$fn$;

REVOKE EXECUTE ON FUNCTION private.compte_tickets_ouverts() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION private.compte_tickets_ouverts() TO authenticated;

-- Index partiel : la policy compte a CHAQUE insertion. `support_tickets_user_id_idx`
-- suffirait au volume actuel (1 ligne), mais le predicat cible exactement la
-- ligne chaude et reste correct quand la file grossit.
CREATE INDEX IF NOT EXISTS support_tickets_ouverts_par_user_idx
  ON public.support_tickets (user_id)
  WHERE status IN ('open', 'in_progress');

-- La policy INSERT existante est REMPLACEE, pas doublee : une policy
-- permissive supplementaire serait OR-ee avec l'ancienne et ne protegerait
-- donc RIEN.
DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;

CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      (SELECT auth.uid()) = user_id
      AND private.compte_tickets_ouverts() < 3
    )
  );

COMMIT;

-- ============================================================================
-- PREUVE (dry-run du 2026-08-12 sur la base de production, dans un bloc DO
-- termine par RAISE EXCEPTION — donc integralement annule ; verifie apres coup :
-- 1 seul ticket en base, 0 ticket de test, policy d'origine restauree).
--
--   tickets 1, 2, 3                      -> ACCEPTES
--   ticket 4                             -> REFUSE
--   ticket au nom d'un AUTRE utilisateur -> REFUSE
--   nouveau ticket apres resolution des 3-> ACCEPTE  (compte les OUVERTS)
--   service_role                         -> ACCEPTE  (edge functions libres)
--   admin                                -> ACCEPTE  (non plafonne)
--
-- ROLLBACK si besoin :
--   DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
--   CREATE POLICY support_tickets_insert ON public.support_tickets
--     FOR INSERT TO authenticated
--     WITH CHECK (is_admin() OR ((SELECT auth.uid()) = user_id));
--   DROP INDEX IF EXISTS public.support_tickets_ouverts_par_user_idx;
--   DROP FUNCTION IF EXISTS private.compte_tickets_ouverts();
-- ============================================================================
