-- 2026-10-04 — Bannissement, sourdine, quotas et suppression en cours sont
-- appliqués par la base, plus seulement par l'écran.
-- Audit du 2026-10-04 : BDD-02, ADM-01.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- « Bannir » écrit `profiles.banned = true`. Aucune politique, aucun
-- déclencheur, aucune fonction serveur ne lisait cette colonne : le seul effet
-- était un calque plein écran dans l'application. Même chose pour la sourdine
-- (`community_muted_until`), pour le quota de 5 messages et 30 réponses par
-- jour (`community_can_post` / `community_can_reply` n'étaient appelées que par
-- le navigateur, avant d'écrire) et pour un compte en cours de suppression
-- (`deleted_at`).
--
-- Prouvé le 2026-10-04 sur la base de production (bloc DO annulé) : un compte
-- banni ET en sourdine publie 8 messages d'affilée.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- Deux fonctions dans `private` (non exposées par l'API) :
--   compte_peut_ecrire()  — faux si le compte est banni ou en cours de suppression
--   compte_en_sourdine()  — vrai tant que la sourdine court
--
-- Des politiques RESTRICTIVES, qui s'ajoutent aux politiques existantes sans
-- les remplacer (une écriture doit satisfaire les deux) :
--
--   table               écriture   condition (l'admin passe toujours)
--   community_posts     création   compte en règle ET community_can_post (sourdine + 5/jour)
--   community_posts     modif.     compte en règle et hors sourdine — OU la ligne finit supprimée
--   community_replies   création   compte en règle ET community_can_reply (sourdine + 30/jour)
--   community_replies   modif.     idem messages
--   engagement          création   compte en règle (réactions, « j'aime », avis)
--   engagement          modif.     compte en règle — OU la ligne finit supprimée
--   support_tickets     création   compte en règle (signalements compris)
--   support_messages    création   compte en règle
--   recipes_unified     création   compte en règle
--   recipes_unified     modif.     compte en règle — OU la ligne finit supprimée
--   shared_baskets      création   compte en règle
--
-- « OU la ligne finit supprimée » : un compte sanctionné garde le droit de
-- RETIRER ce qu'il a publié (droit à l'effacement). Il ne peut ni le modifier
-- ni le rétablir.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QU'ELLE NE FAIT PAS
--
-- - Elle ne coupe pas la session : un compte banni peut encore se connecter et
--   LIRE ce qui est public (comme un visiteur). Couper la connexion demande de
--   poser `banned_until` côté Auth, par une fonction serveur : à faire avec la
--   refonte de l'écran de bannissement.
-- - Elle ne touche pas aux données privées du compte (frigo, favoris, panier).
-- - La sourdine ne bloque ni les réactions ni les avis : elle porte, comme
--   avant, sur les messages et les réponses de la communauté.
--
-- COMPATIBILITÉ : aucun compte n'est banni, en sourdine ni en cours de
-- suppression au moment de l'application (compté le 2026-10-04). Le client en
-- production appelle déjà `community_can_post` avant d'écrire : une écriture
-- refusée ici l'aurait été à l'écran.
--
-- PREUVE : `supabase/probes/20261004_sanctions_appliquees_par_la_base.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION private.compte_peut_ecrire()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (SELECT auth.uid())
       AND (COALESCE(banned, false) OR deleted_at IS NOT NULL)
  );
$function$;

CREATE OR REPLACE FUNCTION private.compte_en_sourdine()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = (SELECT auth.uid())
       AND community_muted_until IS NOT NULL
       AND community_muted_until > now()
  );
$function$;

REVOKE ALL ON FUNCTION private.compte_peut_ecrire() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.compte_en_sourdine() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.compte_peut_ecrire() TO authenticated;
GRANT EXECUTE ON FUNCTION private.compte_en_sourdine() TO authenticated;

-- Messages de la communauté
DROP POLICY IF EXISTS sanctions_insert ON public.community_posts;
CREATE POLICY sanctions_insert ON public.community_posts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR ((SELECT private.compte_peut_ecrire()) AND public.community_can_post(user_id))
  );

DROP POLICY IF EXISTS sanctions_update ON public.community_posts;
CREATE POLICY sanctions_update ON public.community_posts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    (SELECT public.is_admin())
    OR deleted_at IS NOT NULL
    OR ((SELECT private.compte_peut_ecrire()) AND NOT (SELECT private.compte_en_sourdine()))
  );

-- Réponses
DROP POLICY IF EXISTS sanctions_insert ON public.community_replies;
CREATE POLICY sanctions_insert ON public.community_replies
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR ((SELECT private.compte_peut_ecrire()) AND public.community_can_reply(user_id))
  );

DROP POLICY IF EXISTS sanctions_update ON public.community_replies;
CREATE POLICY sanctions_update ON public.community_replies
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    (SELECT public.is_admin())
    OR deleted_at IS NOT NULL
    OR ((SELECT private.compte_peut_ecrire()) AND NOT (SELECT private.compte_en_sourdine()))
  );

-- Réactions, « j'aime », avis
DROP POLICY IF EXISTS sanctions_insert ON public.engagement;
CREATE POLICY sanctions_insert ON public.engagement
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT private.compte_peut_ecrire()));

DROP POLICY IF EXISTS sanctions_update ON public.engagement;
CREATE POLICY sanctions_update ON public.engagement
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    (SELECT public.is_admin())
    OR deleted_at IS NOT NULL
    OR (SELECT private.compte_peut_ecrire())
  );

-- Support et signalements
DROP POLICY IF EXISTS sanctions_insert ON public.support_tickets;
CREATE POLICY sanctions_insert ON public.support_tickets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT private.compte_peut_ecrire()));

DROP POLICY IF EXISTS sanctions_insert ON public.support_messages;
CREATE POLICY sanctions_insert ON public.support_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT private.compte_peut_ecrire()));

-- Recettes
DROP POLICY IF EXISTS sanctions_insert ON public.recipes_unified;
CREATE POLICY sanctions_insert ON public.recipes_unified
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin()) OR (SELECT private.compte_peut_ecrire()));

DROP POLICY IF EXISTS sanctions_update ON public.recipes_unified;
CREATE POLICY sanctions_update ON public.recipes_unified
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    (SELECT public.is_admin())
    OR deleted_at IS NOT NULL
    OR (SELECT private.compte_peut_ecrire())
  );

-- Liens de panier partagé
DROP POLICY IF EXISTS sanctions_insert ON public.shared_baskets;
CREATE POLICY sanctions_insert ON public.shared_baskets
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.compte_peut_ecrire()));

COMMIT;
