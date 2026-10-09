-- 2026-10-05 — Les signalements ont leur propre plafond, séparé des demandes
-- au support.
-- Audit du 2026-10-04 : CPT-17 (la partie « plafond de tickets partagé »).
--
-- ══════════════════════════════════════════════════════════════════════════
-- LE DÉFAUT
--
-- `private.compte_tickets_ouverts()` comptait TOUS les tickets ouverts d'un
-- compte, signalements compris, contre un seul plafond de 3. Trois signalements
-- en attente empêchaient d'écrire au support (« Pourquoi mon compte… ? ») ; trois
-- questions empêchaient de signaler un contenu.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CE QUE FAIT CETTE MIGRATION
--
-- - `compte_tickets_ouverts()` ne compte plus que les demandes (type différent
--   de 'report') ; `compte_signalements_ouverts()` compte les signalements.
--   Mêmes statuts « ouverts » ('open', 'in_progress'), sans paramètre (on ne
--   sonde pas le compteur d'autrui).
-- - La règle d'insertion choisit le plafond selon le type : 10 signalements,
--   3 demandes. L'admin n'est pas plafonné.
--
-- COMPATIBILITÉ : la v0.145 compte encore côté navigateur TOUS les tickets
-- ouverts avant d'envoyer : elle reste plus stricte que la base jusqu'à la
-- release, sans rien casser. Le plafond côté navigateur suit dans le même lot
-- (`MAX_OPEN_REPORTS`, `plafond-tickets-coherence.test.js`).
--
-- PREUVE : `supabase/probes/20261005_signalements_comptes_a_part.sql`.
-- ══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION private.compte_tickets_ouverts()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT count(*)::int
  FROM public.support_tickets
  WHERE user_id = (SELECT auth.uid())
    AND status IN ('open', 'in_progress')
    AND type IS DISTINCT FROM 'report';
$function$;

CREATE OR REPLACE FUNCTION private.compte_signalements_ouverts()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT count(*)::int
  FROM public.support_tickets
  WHERE user_id = (SELECT auth.uid())
    AND status IN ('open', 'in_progress')
    AND type = 'report';
$function$;

REVOKE ALL ON FUNCTION private.compte_signalements_ouverts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.compte_signalements_ouverts() TO authenticated;

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      (SELECT auth.uid()) = user_id
      AND CASE WHEN type = 'report' THEN private.compte_signalements_ouverts() < 10
               ELSE private.compte_tickets_ouverts() < 3
          END
    )
  );

COMMIT;
