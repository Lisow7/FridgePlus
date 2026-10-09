-- Sonde des deux plafonds (migration 20261005_signalements_comptes_a_part.sql).
-- Audit du 2026-10-04 : CPT-17.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau d'un compte ordinaire : avec trois questions ouvertes, signaler
-- un contenu ; avec dix signalements en attente, en envoyer un onzième, puis
-- poser une question.
--
-- Essai à blanc : le DDL de la migration est injecté à la place de la ligne
-- « [essai à blanc …] » ci-dessous (script de composition).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  u    uuid;                      -- un compte ordinaire en règle
  q    uuid;                      -- une de ses questions, créée par la sonde
  r    text := '';
BEGIN
  SELECT id INTO u FROM public.profiles
   WHERE role = 'user' AND NOT banned AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  IF u IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut un compte ordinaire en règle';
  END IF;

  CREATE FUNCTION public.__sonde_ligne(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q;
      obtenu := 'ACCEPTÉ';
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'REFUSÉ ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN left(obtenu, length(attendu)) = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  CREATE FUNCTION public.__sonde_valeur(libelle text, attendu text, q text) RETURNS text
  LANGUAGE plpgsql AS $f$
  DECLARE obtenu text;
  BEGIN
    BEGIN
      EXECUTE q INTO obtenu;
      obtenu := coalesce(obtenu, 'NULL');
    EXCEPTION WHEN OTHERS THEN
      obtenu := 'ERREUR ' || SQLSTATE || ' ' || left(SQLERRM, 70);
    END;
    RETURN E'\n' || libelle || ' — attendu ' || attendu || ' : ' || obtenu
      || CASE WHEN obtenu = attendu THEN '' ELSE ' ⚠' END;
  END
  $f$;

  GRANT EXECUTE ON FUNCTION public.__sonde_ligne(text, text, text), public.__sonde_valeur(text, text, text)
    TO anon, authenticated, service_role;

  -- [essai à blanc : le DDL de la migration est injecté ici]

  -- Le compte part de trois questions ouvertes (écrites en propriétaire).
  PERFORM set_config('request.jwt.claims', '', true);
  UPDATE public.support_tickets SET status = 'resolved' WHERE user_id = u AND status <> 'resolved';
  INSERT INTO public.support_tickets (user_id, type, title, status) VALUES
    (u, 'question', 'Sonde Q1', 'open'), (u, 'question', 'Sonde Q2', 'open'), (u, 'request', 'Sonde Q3', 'in_progress');
  SELECT id INTO q FROM public.support_tickets WHERE user_id = u AND title = 'Sonde Q1';

  ---------------------------------------------------------------------------
  -- A. Trois demandes ouvertes
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('A1 une quatrième question est refusée (inchangé)', 'REFUSÉ 42501',
    format('INSERT INTO public.support_tickets (user_id, type, title) VALUES (%L, ''question'', ''Sonde Q4'')', u));
  r := r || public.__sonde_ligne('A2 … mais signaler un contenu passe', 'ACCEPTÉ',
    format('INSERT INTO public.support_tickets (user_id, type, title, target_type, target_id, reason_key) VALUES (%L, ''report'', ''Sonde S1'', ''recipe'', ''r-1'', ''spam'')', u));
  r := r || public.__sonde_ligne('A3 … aussi par ouvrir_ticket (le chemin de l''app)', 'ACCEPTÉ',
    'SELECT public.ouvrir_ticket(''report'', ''Sonde S2'', NULL, ''recipe'', ''r-2'', ''spam'')');
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- B. Dix signalements en attente
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  INSERT INTO public.support_tickets (user_id, type, title, status, target_type, target_id, reason_key)
  SELECT u, 'report', 'Sonde S' || g, 'open', 'recipe', 'r-' || g, 'spam' FROM generate_series(3, 10) g;
  r := r || public.__sonde_valeur('B0 (préparation) dix signalements ouverts', '10',
    format('SELECT count(*)::text FROM public.support_tickets WHERE user_id = %L AND type = ''report'' AND status IN (''open'', ''in_progress'')', u));
  UPDATE public.support_tickets SET status = 'resolved' WHERE id = q;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('B1 un onzième signalement est refusé', 'REFUSÉ 42501',
    format('INSERT INTO public.support_tickets (user_id, type, title, target_type, target_id, reason_key) VALUES (%L, ''report'', ''Sonde S11'', ''recipe'', ''r-11'', ''spam'')', u));
  r := r || public.__sonde_ligne('B2 … mais une question passe (deux demandes ouvertes sur trois)', 'ACCEPTÉ',
    format('INSERT INTO public.support_tickets (user_id, type, title) VALUES (%L, ''question'', ''Sonde Q5'')', u));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- C. La forme
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('C1 le compteur des signalements ne s''appelle pas en visiteur, s''appelle connecté', 'false true',
    'SELECT has_function_privilege(''anon'', ''private.compte_signalements_ouverts()'', ''EXECUTE'')::text || '' '' || has_function_privilege(''authenticated'', ''private.compte_signalements_ouverts()'', ''EXECUTE'')::text');
  r := r || public.__sonde_valeur('C2 la règle d''insertion choisit le plafond selon le type', 'oui',
    'SELECT CASE WHEN with_check LIKE ''%compte_signalements_ouverts() < 10%'' AND with_check LIKE ''%compte_tickets_ouverts() < 3%'' THEN ''oui'' ELSE with_check END FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''support_tickets'' AND policyname = ''support_tickets_insert''');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS : relevés consignés hors dépôt public (notes internes de l'audit).