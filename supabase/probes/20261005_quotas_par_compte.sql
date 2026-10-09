-- Sonde du plafond d'e-mails par compte (migration
-- 20261005_quotas_par_compte.sql). Audit du 2026-10-04 : BDD-08.
--
-- Même principe que les autres sondes de ce dossier : un seul bloc DO, terminé
-- par RAISE EXCEPTION, donc RIEN n'est écrit. Le « message d'erreur » est le
-- rapport ; une ligne « ⚠ » est un écart avec ce qui est attendu.
--
-- Dans la peau de la clé service (les fonctions edge), d'un compte connecté et
-- d'un visiteur : réserver des e-mails jusqu'au plafond, puis un de trop ;
-- essayer d'appeler la fonction ou de lire la table depuis l'API.
--
-- Essai à blanc : le DDL de la migration est injecté à la place de la ligne
-- « [essai à blanc …] » ci-dessous (script de composition).
--
-- RÉSULTATS : voir la fin du fichier.

DO $probe$
DECLARE
  u    uuid;                      -- un compte
  v    uuid;                      -- un autre compte
  r    text := '';
BEGIN
  SELECT id INTO u FROM public.profiles WHERE role = 'user' AND deleted_at IS NULL ORDER BY created_at LIMIT 1;
  SELECT id INTO v FROM public.profiles WHERE role = 'user' AND deleted_at IS NULL AND id <> u ORDER BY created_at LIMIT 1;
  IF u IS NULL OR v IS NULL THEN
    RAISE EXCEPTION 'SONDE IMPOSSIBLE : il faut deux comptes';
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

  ---------------------------------------------------------------------------
  -- A. La clé service (les fonctions edge) : plafond de 3 pour la sonde
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  r := r || public.__sonde_valeur('A1 premier e-mail du jour', 'true',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 3)::text', u));
  r := r || public.__sonde_valeur('A2 deuxième', 'true',
    format('SELECT public.reserver_un_email(%L, ''account_deleted'', 3)::text', u));
  r := r || public.__sonde_valeur('A3 troisième (le plafond)', 'true',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 3)::text', u));
  r := r || public.__sonde_valeur('A4 un de trop : refusé', 'false',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 3)::text', u));
  r := r || public.__sonde_valeur('A5 … et pas écrit (3 lignes pour ce compte)', '3',
    format('SELECT count(*)::text FROM public.email_log WHERE user_id = %L', u));
  r := r || public.__sonde_valeur('A6 un autre compte a son propre plafond', 'true',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 3)::text', v));
  r := r || public.__sonde_ligne('A7 une sorte hors format', 'REFUSÉ 23514',
    format('SELECT public.reserver_un_email(%L, ''Pas Bon !'', 10)', v));
  r := r || public.__sonde_valeur('A8 sans compte : refusé', 'false',
    'SELECT public.reserver_un_email(NULL, ''profile_change'', 3)::text');
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- B. Un envoi d'il y a deux jours ne compte plus
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_ligne('B0 (préparation) on vide les envois de l''autre compte', 'ACCEPTÉ',
    format('DELETE FROM public.email_log WHERE user_id = %L', v));
  r := r || public.__sonde_ligne('B0'' (préparation) un envoi vieux de deux jours', 'ACCEPTÉ',
    format('INSERT INTO public.email_log (user_id, kind, created_at) VALUES (%L, ''profile_change'', now() - interval ''2 days'')', v));
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  SET LOCAL ROLE service_role;
  r := r || public.__sonde_valeur('B1 plafond de 1, un envoi vieux de deux jours : la réservation passe', 'true',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 1)::text', v));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- C. Depuis l'API : ni la fonction ni la table
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  r := r || public.__sonde_ligne('C1 un compte connecté appelle la fonction', 'REFUSÉ 42501',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 10)', u));
  r := r || public.__sonde_ligne('C2 … lit la table', 'REFUSÉ 42501', 'SELECT count(*) FROM public.email_log');
  r := r || public.__sonde_ligne('C3 … y écrit', 'REFUSÉ 42501',
    format('INSERT INTO public.email_log (user_id, kind) VALUES (%L, ''profile_change'')', u));
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  SET LOCAL ROLE anon;
  r := r || public.__sonde_ligne('C4 un visiteur appelle la fonction', 'REFUSÉ 42501',
    format('SELECT public.reserver_un_email(%L, ''profile_change'', 10)', u));
  RESET ROLE;

  ---------------------------------------------------------------------------
  -- D. La forme
  ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', '', true);
  r := r || public.__sonde_valeur('D1 RLS active sur email_log', 'true',
    'SELECT relrowsecurity::text FROM pg_class WHERE oid = ''public.email_log''::regclass');
  r := r || public.__sonde_valeur('D2 la purge à 7 jours est planifiée', '1',
    'SELECT count(*)::text FROM cron.job WHERE jobname = ''purge_email_log'' AND command LIKE ''%email_log%7 days%''');
  r := r || public.__sonde_valeur('D3 la fonction n''est pas SECURITY DEFINER', 'false',
    'SELECT prosecdef::text FROM pg_proc WHERE oid = ''public.reserver_un_email(uuid, text, integer)''::regprocedure');

  PERFORM set_config('request.jwt.claims', '', true);
  RAISE EXCEPTION E'RAPPORT DE LA SONDE (rien n''a été écrit)%\n— % écart(s)', r, (length(r) - length(replace(r, '⚠', '')));
END
$probe$;

-- ══════════════════════════════════════════════════════════════════════════
-- RÉSULTATS (2026-10-05, vraie base — chaque passage annulé, rien d'écrit)
--
-- AVANT la migration : 18 écarts sur 18 gestes (ni la table ni la fonction
--   n'existaient : le plafond d'e-mails n'était tenu qu'en mémoire d'instance).
--
-- ESSAI À BLANC (DDL de la migration injecté dans le bloc) : 0 écart sur
--   18 gestes.
--
-- APRÈS application (`quotas_par_compte`, version 20261005144904) : 0 écart
--   sur 18 gestes. Advisors : une note INFO `rls_enabled_no_policy` sur
--   `email_log`, voulue (la note interne sur les advisors Supabase).
