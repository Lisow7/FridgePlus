-- Sonde de la migration 20261010014519_opposition_au_profilage_en_base.sql : la règle
-- d'insertion de spending_events refuse une dépense enregistrée contre
-- l'opposition au profilage.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit — même l'essai à blanc du DDL est
-- annulé. Le « message d'erreur » est le rapport ; une ligne « ⚠ » est un écart
-- avec ce qui est attendu.
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  r text := '';
  regle text;
BEGIN
  -- A1 — avant : la règle ne lit pas l'opposition.
  SELECT with_check INTO regle FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'spending_events' AND policyname = 'spending_events_insert_own';
  r := r || E'\nA1 règle avant — attendu sans is_profiling_opted_out : ' || coalesce(regle, 'ABSENTE')
    || CASE WHEN regle LIKE '%is_profiling_opted_out%' THEN ' (déjà appliquée)' ELSE '' END;

  -- A2 — la fonction existe, sous les droits de l'appelant et stable.
  SELECT p.prosecdef::text || '/' || p.provolatile::text INTO regle
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'is_profiling_opted_out';
  r := r || E'\nA2 is_profiling_opted_out (secdef/volatilité) — attendu false/s : ' || coalesce(regle, 'ABSENTE')
    || CASE WHEN regle = 'false/s' THEN '' ELSE ' ⚠' END;

  -- ESSAI À BLANC : la migration, puis la vérification ; tout est annulé à la fin.
  DROP POLICY IF EXISTS spending_events_insert_own ON public.spending_events;
  CREATE POLICY spending_events_insert_own ON public.spending_events
    AS PERMISSIVE FOR INSERT TO public
    WITH CHECK (
      user_id = (select auth.uid())
      AND NOT public.is_profiling_opted_out((select auth.uid()))
    );

  SELECT with_check INTO regle FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'spending_events' AND policyname = 'spending_events_insert_own';
  r := r || E'\nB1 règle après l''essai — attendu avec is_profiling_opted_out : '
    || CASE WHEN regle LIKE '%is_profiling_opted_out%' THEN 'oui' ELSE 'non ⚠' END;
  r := r || E'\nB2 les trois règles de la table — attendu 3 : '
    || (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spending_events');

  RAISE EXCEPTION 'SONDE opposition_au_profilage_en_base :%', r;
END
$probe$;

-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).